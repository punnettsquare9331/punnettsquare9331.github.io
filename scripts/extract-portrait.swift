#!/usr/bin/env swift
// Local, non-generative subject extraction using macOS 14+ Vision.
// Select one subject with normalized x/y coordinates, measured from top-left.
// swift scripts/extract-portrait.swift INPUT OUTPUT.png 0.28 0.65
// Optional final argument: crop x,y,width,height in upright source pixels.
// Point coordinates are relative to the crop when one is provided.
import Foundation
import Vision
import CoreImage
import ImageIO

func fail(_ message: String) -> Never {
    fputs("\(message)\n", stderr)
    exit(1)
}

let args = CommandLine.arguments
guard (args.count == 5 || args.count == 6), let pointX = Double(args[3]), let pointY = Double(args[4]),
      (0...1).contains(pointX), (0...1).contains(pointY) else {
    fail("Usage: swift scripts/extract-portrait.swift INPUT OUTPUT.png X Y [cropX,cropY,cropWidth,cropHeight]\nX and Y are normalized image coordinates measured from the top-left of the image or optional crop.")
}
let input = URL(fileURLWithPath: args[1])
let output = URL(fileURLWithPath: args[2])
guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fail("Cannot read input image: \(input.path)")
}
let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
let orientationValue = properties?[kCGImagePropertyOrientation] as? UInt32 ?? 1
let orientation = CGImagePropertyOrientation(rawValue: orientationValue) ?? .up
var workingImage = image
var workingOrientation = orientation
var cropOrigin = CGPoint.zero
if args.count == 6 {
    let values = args[5].split(separator: ",").compactMap { Double($0) }
    guard values.count == 4, values[0] >= 0, values[1] >= 0, values[2] > 0, values[3] > 0 else {
        fail("Crop must contain x,y,width,height in upright source pixels.")
    }
    let upright = CIImage(cgImage: image).oriented(orientation)
    let context = CIContext()
    let crop = CGRect(x: values[0], y: values[1], width: values[2], height: values[3])
    guard let normalized = context.createCGImage(upright, from: upright.extent),
          let cropped = normalized.cropping(to: crop) else { fail("Crop lies outside the source image.") }
    workingImage = cropped
    workingOrientation = .up
    cropOrigin = crop.origin
}
let handler = VNImageRequestHandler(cgImage: workingImage, orientation: workingOrientation)
let request = VNGeneratePersonInstanceMaskRequest()
let foregroundRequest = VNGenerateForegroundInstanceMaskRequest()
do {
    try handler.perform([request, foregroundRequest])
    guard let observation = request.results?.first else { fail("Vision found no foreground subject.") }
    let mask = observation.instanceMask
    CVPixelBufferLockBaseAddress(mask, .readOnly)
    let width = CVPixelBufferGetWidth(mask)
    let height = CVPixelBufferGetHeight(mask)
    let x = min(width - 1, Int(pointX * Double(width)))
    let y = min(height - 1, Int(pointY * Double(height)))
    let rowBytes = CVPixelBufferGetBytesPerRow(mask)
    guard let base = CVPixelBufferGetBaseAddress(mask) else { fail("Cannot read instance mask.") }
    let format = CVPixelBufferGetPixelFormatType(mask)
    let selected: Int
    if format == kCVPixelFormatType_OneComponent8 {
        selected = Int(base.load(fromByteOffset: y * rowBytes + x, as: UInt8.self))
    } else if format == kCVPixelFormatType_OneComponent32Float {
        selected = Int(base.load(fromByteOffset: y * rowBytes + x * 4, as: Float.self))
    } else {
        fail("Unsupported instance-mask pixel format: \(format)")
    }
    CVPixelBufferUnlockBaseAddress(mask, .readOnly)
    guard selected != 0, observation.allInstances.contains(selected) else {
        fail("Selection point lies on the background. Choose a point inside the subject.")
    }
    let personBuffer = try observation.generateMaskedImage(
        ofInstances: IndexSet(integer: selected), from: handler, croppedToInstancesExtent: false
    )
    guard let foreground = foregroundRequest.results?.first else { fail("Vision found no foreground objects.") }
    let foregroundBuffer = try foreground.generateMaskedImage(
        ofInstances: foreground.allInstances, from: handler, croppedToInstancesExtent: false
    )
    // Object matting retains hair detail. Person confidence excludes nearby people
    // when Vision groups touching subjects as a single foreground object.
    let foregroundImage = CIImage(cvPixelBuffer: foregroundBuffer)
    let confidenceRange = 0.92 - 0.58
    let confidenceVector = CIVector(x: 0, y: 0, z: 0, w: 1 / confidenceRange)
    let gate = CIImage(cvPixelBuffer: personBuffer).applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": confidenceVector,
        "inputGVector": confidenceVector,
        "inputBVector": confidenceVector,
        "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0),
        "inputBiasVector": CIVector(x: -0.58 / confidenceRange, y: -0.58 / confidenceRange,
                                     z: -0.58 / confidenceRange, w: 1)
    ]).applyingFilter("CIColorClamp", parameters: [
        "inputMinComponents": CIVector(x: 0, y: 0, z: 0, w: 0),
        "inputMaxComponents": CIVector(x: 1, y: 1, z: 1, w: 1)
    ])
    let result = foregroundImage.applyingFilter("CIBlendWithMask", parameters: [
        "inputBackgroundImage": CIImage(color: .clear).cropped(to: foregroundImage.extent),
        "inputMaskImage": gate
    ])
    let context = CIContext(options: [.cacheIntermediates: false])
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
    let outputWidth = Int(result.extent.width)
    let outputHeight = Int(result.extent.height)
    var pixels = [UInt8](repeating: 0, count: outputWidth * outputHeight * 4)
    context.render(result, toBitmap: &pixels, rowBytes: outputWidth * 4,
                   bounds: result.extent, format: .RGBA8, colorSpace: colorSpace)
    var minX = outputWidth, minY = outputHeight, maxX = -1, maxY = -1
    for y in 0..<outputHeight {
        for x in 0..<outputWidth {
            if pixels[(y * outputWidth + x) * 4 + 3] > 5 {
                minX = min(minX, x); minY = min(minY, y)
                maxX = max(maxX, x); maxY = max(maxY, y)
            }
        }
    }
    guard maxX >= minX, maxY >= minY else { fail("The selected subject has no opaque pixels.") }
    // Bitmap rows start at the top, whereas Core Image crop coordinates start below.
    let crop = CGRect(x: minX, y: outputHeight - maxY - 1,
                      width: maxX - minX + 1, height: maxY - minY + 1)
    let trimmed = result.cropped(to: crop)
    try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
    try context.writePNGRepresentation(of: trimmed, to: output, format: .RGBA8, colorSpace: colorSpace)
    print("Selected instance \(selected) of \(observation.allInstances.count).")
    print("Alpha bounds in upright source pixels (top-left): \(minX + Int(cropOrigin.x)),\(minY + Int(cropOrigin.y)),\(maxX - minX + 1),\(maxY - minY + 1)")
    print("Wrote \(Int(trimmed.extent.width))×\(Int(trimmed.extent.height)) transparent PNG: \(output.path)")
} catch {
    fail("Subject extraction failed: \(error)")
}
