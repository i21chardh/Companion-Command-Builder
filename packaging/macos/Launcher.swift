import Foundation
import AVFoundation
import Speech
import AppKit
import CoreAudio
import AudioToolbox

struct AudioInputDevice: Codable {
    let uid: String
    let name: String
    let isDefault: Bool
    let deviceID: AudioDeviceID
    let channels: Int
}

func defaultAudioInputDeviceID() -> AudioDeviceID {
    var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultInputDevice, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var value = AudioDeviceID(0)
    var size = UInt32(MemoryLayout<AudioDeviceID>.size)
    guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &value) == noErr else { return 0 }
    return value
}

func audioStringProperty(_ objectID: AudioObjectID, _ selector: AudioObjectPropertySelector) -> String? {
    var address = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var value: Unmanaged<CFString>?
    var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    guard AudioObjectGetPropertyData(objectID, &address, 0, nil, &size, &value) == noErr else { return nil }
    return value?.takeUnretainedValue() as String?
}

func listAudioInputDevices() -> [AudioInputDevice] {
    var address = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDevices, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var size: UInt32 = 0
    guard AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size) == noErr else { return [] }
    var ids = [AudioDeviceID](repeating: 0, count: Int(size) / MemoryLayout<AudioDeviceID>.size)
    guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &ids) == noErr else { return [] }
    let defaultID = defaultAudioInputDeviceID()
    return ids.compactMap { id in
        var streamsAddress = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreams, mScope: kAudioDevicePropertyScopeInput, mElement: kAudioObjectPropertyElementMain)
        var streamsSize: UInt32 = 0
        guard AudioObjectGetPropertyDataSize(id, &streamsAddress, 0, nil, &streamsSize) == noErr, streamsSize > 0,
              let uid = audioStringProperty(id, kAudioDevicePropertyDeviceUID), let name = audioStringProperty(id, kAudioObjectPropertyName) else { return nil }
        var configAddress = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreamConfiguration, mScope: kAudioDevicePropertyScopeInput, mElement: kAudioObjectPropertyElementMain)
        var configSize: UInt32 = 0
        var channelCount = 0
        if AudioObjectGetPropertyDataSize(id, &configAddress, 0, nil, &configSize) == noErr {
            let raw = UnsafeMutableRawPointer.allocate(byteCount: Int(configSize), alignment: MemoryLayout<AudioBufferList>.alignment)
            defer { raw.deallocate() }
            if AudioObjectGetPropertyData(id, &configAddress, 0, nil, &configSize, raw) == noErr {
                let buffers = UnsafeMutableAudioBufferListPointer(raw.assumingMemoryBound(to: AudioBufferList.self))
                channelCount = buffers.reduce(0) { $0 + Int($1.mNumberChannels) }
            }
        }
        return AudioInputDevice(uid: uid, name: name, isDefault: id == defaultID, deviceID: id, channels: max(1, channelCount))
    }.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
}

func emitAudioDevices() {
    let encoder = JSONEncoder()
    if let data = try? encoder.encode(listAudioInputDevices()), let text = String(data: data, encoding: .utf8) { print(text) }
}

struct DictationResult: Codable {
    let ok: Bool
    let transcript: String
    let error: String
}

func emit(_ result: DictationResult) {
    let encoder = JSONEncoder()
    if let data = try? encoder.encode(result), let text = String(data: data, encoding: .utf8) {
        print(text)
    }
}

func requestSpeechPermission() -> Bool {
    let semaphore = DispatchSemaphore(value: 0)
    var allowed = false
    SFSpeechRecognizer.requestAuthorization { status in
        allowed = status == .authorized
        semaphore.signal()
    }
    semaphore.wait()
    return allowed
}

func requestMicrophonePermission() -> Bool {
    let semaphore = DispatchSemaphore(value: 0)
    var allowed = false
    AVCaptureDevice.requestAccess(for: .audio) { granted in
        allowed = granted
        semaphore.signal()
    }
    semaphore.wait()
    return allowed
}

final class SpeechAudioCaptureDelegate: NSObject, AVCaptureAudioDataOutputSampleBufferDelegate {
    private let request: SFSpeechAudioBufferRecognitionRequest
    private let lock = NSLock()
    private var receivedBufferCount = 0

    var hasReceivedAudio: Bool {
        lock.lock()
        defer { lock.unlock() }
        return receivedBufferCount > 0
    }

    init(request: SFSpeechAudioBufferRecognitionRequest) {
        self.request = request
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        lock.lock()
        receivedBufferCount += 1
        lock.unlock()
        request.appendAudioSampleBuffer(sampleBuffer)
    }
}

func runDictation(deviceUID: String? = nil, channelIndex: Int? = nil) {
    guard requestSpeechPermission() else {
        emit(DictationResult(ok: false, transcript: "", error: "Speech Recognition permission was not granted. Enable it in System Settings → Privacy & Security → Speech Recognition."))
        return
    }
    guard requestMicrophonePermission() else {
        emit(DictationResult(ok: false, transcript: "", error: "Microphone permission was not granted. Enable it in System Settings → Privacy & Security → Microphone."))
        return
    }
    guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")), recognizer.isAvailable else {
        emit(DictationResult(ok: false, transcript: "", error: "Apple Speech Recognition is currently unavailable."))
        return
    }

    var selectedDevice: AudioInputDevice?
    if let deviceUID, !deviceUID.isEmpty {
        guard let device = listAudioInputDevices().first(where: { $0.uid == deviceUID }) else {
            emit(DictationResult(ok: false, transcript: "", error: "The selected audio input is no longer connected. Refresh Speech Input and choose another device."))
            return
        }
        selectedDevice = device
    }

    let captureDevice: AVCaptureDevice
    if let selectedDevice {
        guard let device = AVCaptureDevice.devices(for: .audio).first(where: { $0.uniqueID == selectedDevice.uid }) else {
            emit(DictationResult(ok: false, transcript: "", error: "The selected audio input \(selectedDevice.name) is not available to macOS capture. Disconnect and reconnect it, then refresh Speech Input."))
            return
        }
        captureDevice = device
    } else {
        guard let device = AVCaptureDevice.default(for: .audio) else {
            emit(DictationResult(ok: false, transcript: "", error: "No audio input is available."))
            return
        }
        captureDevice = device
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.requiresOnDeviceRecognition = recognizer.supportsOnDeviceRecognition
    request.taskHint = .dictation
    request.contextualStrings = ["Companion", "Stream Deck", "OSC", "MIDI", "OBS", "ATEM", "QLab", "macro", "snapshot", "toggle", "mute", "channel", "aux", "control group"]

    let session = AVCaptureSession()
    let output = AVCaptureAudioDataOutput()
    output.audioSettings = [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVSampleRateKey: 16_000,
        AVNumberOfChannelsKey: 1,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsNonInterleaved: false
    ]
    let captureDelegate = SpeechAudioCaptureDelegate(request: request)
    let captureQueue = DispatchQueue(label: "com.premieraudiosolutions.ccb.speech-capture")
    do {
        let input = try AVCaptureDeviceInput(device: captureDevice)
        session.beginConfiguration()
        guard session.canAddInput(input), session.canAddOutput(output) else {
            session.commitConfiguration()
            emit(DictationResult(ok: false, transcript: "", error: "The selected microphone cannot be connected to the macOS audio capture session."))
            return
        }
        session.addInput(input)
        session.addOutput(output)
        output.setSampleBufferDelegate(captureDelegate, queue: captureQueue)
        session.commitConfiguration()
    } catch {
        emit(DictationResult(ok: false, transcript: "", error: "The selected audio input \(captureDevice.localizedName) could not be activated: \(error.localizedDescription)"))
        return
    }

    if let channelIndex, channelIndex >= 0 {
        let channels = output.connections.flatMap { $0.audioChannels }
        if channelIndex < channels.count {
            for (index, channel) in channels.enumerated() { channel.isEnabled = index == channelIndex }
        }
    }

    var transcript = ""
    var lastUpdate = Date()
    var finished = false
    let task = recognizer.recognitionTask(with: request) { result, error in
        if let result = result {
            transcript = result.bestTranscription.formattedString
            lastUpdate = Date()
            finished = result.isFinal
        }
        if error != nil { finished = true }
    }

    session.startRunning()
    guard session.isRunning else {
        output.setSampleBufferDelegate(nil, queue: nil)
        task.cancel()
        emit(DictationResult(ok: false, transcript: "", error: "The microphone capture session could not be started. Check that the selected input is not in exclusive use by another app."))
        return
    }

    let started = Date()
    while !finished && Date().timeIntervalSince(started) < 45 {
        RunLoop.current.run(until: Date().addingTimeInterval(0.08))
        if !transcript.isEmpty && Date().timeIntervalSince(lastUpdate) > 4.5 { break }
    }

    session.stopRunning()
    output.setSampleBufferDelegate(nil, queue: nil)
    request.endAudio()
    task.cancel()

    if transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        let message = captureDelegate.hasReceivedAudio
            ? "Audio reached the app, but Apple Speech did not recognize speech. Verify the selected EVO input channel and its input meter, then try again."
            : "No audio buffers reached the app. Verify the selected EVO input channel, macOS Microphone permission, and that another app is not holding the interface."
        emit(DictationResult(ok: false, transcript: "", error: message))
    } else {
        emit(DictationResult(ok: true, transcript: transcript, error: ""))
    }
}

func processSucceeded(_ executable: String, _ arguments: [String]) -> Bool {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: executable)
    process.arguments = arguments
    process.standardOutput = FileHandle.nullDevice
    process.standardError = FileHandle.nullDevice
    do { try process.run(); process.waitUntilExit(); return process.terminationStatus == 0 }
    catch { return false }
}

final class BuilderAppDelegate: NSObject, NSApplicationDelegate {
    private var builderURL = "http://127.0.0.1:3100"
    private var node: Process?
    private var statusItem: NSStatusItem?
    private var shuttingDown = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        installStatusMenu()
        startServer()
    }

    private func installStatusMenu() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "CCB"
        item.button?.toolTip = "Companion Command Builder"
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Open Builder", action: #selector(openBuilder), keyEquivalent: "o"))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit Companion Command Builder", action: #selector(quitBuilder), keyEquivalent: "q"))
        menu.items.forEach { $0.target = self }
        item.menu = menu
        statusItem = item
    }

    private func startServer() {
        guard let port = (3100...3110).first(where: { port in
            !processSucceeded("/usr/sbin/lsof", ["-nP", "-iTCP:\(port)", "-sTCP:LISTEN"])
        }) else {
            showStartError("Local ports 3100 through 3110 are already in use.")
            NSApplication.shared.terminate(nil)
            return
        }
        builderURL = "http://127.0.0.1:\(port)"
        let executable = URL(fileURLWithPath: CommandLine.arguments[0]).standardizedFileURL
        let resources = executable.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Resources")
        let server = Process()
        server.executableURL = resources.appendingPathComponent("runtime/node")
        server.arguments = [resources.appendingPathComponent("app/src/server.js").path]
        var environment = ProcessInfo.processInfo.environment
        environment["COMPANION_BUILDER_SPEECH_HELPER"] = executable.path
        environment["COMPANION_BUILDER_PORT"] = String(port)
        server.environment = environment
        let logURL = FileManager.default.temporaryDirectory.appendingPathComponent("companion-command-builder-server.log")
        FileManager.default.createFile(atPath: logURL.path, contents: nil)
        let logHandle = try? FileHandle(forWritingTo: logURL)
        server.standardOutput = logHandle ?? FileHandle.nullDevice
        server.standardError = logHandle ?? FileHandle.nullDevice
        server.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self, !self.shuttingDown else { return }
                try? logHandle?.close()
                let details = (try? String(contentsOf: logURL, encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines)
                let suffix = details?.isEmpty == false ? "\n\n\(details!)" : ""
                self.showStartError("The local server stopped unexpectedly (exit \(process.terminationStatus)).\(suffix)")
                NSApplication.shared.terminate(nil)
            }
        }
        do {
            try server.run()
            node = server
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in self?.openBuilder() }
        } catch {
            showStartError(error.localizedDescription)
            NSApplication.shared.terminate(nil)
        }
    }

    @objc private func openBuilder() {
        guard let url = URL(string: builderURL) else { return }
        NSWorkspace.shared.open(url)
    }

    @objc private func quitBuilder() {
        NSApplication.shared.terminate(nil)
    }

    func applicationWillTerminate(_ notification: Notification) {
        shuttingDown = true
        guard let server = node, server.isRunning else { return }
        server.terminate()
        let deadline = Date().addingTimeInterval(2)
        while server.isRunning && Date() < deadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.05))
        }
        if server.isRunning { kill(server.processIdentifier, SIGKILL) }
        server.waitUntilExit()
    }

    private func showStartError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "Companion Command Builder could not start"
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.runModal()
    }
}

func launchBuilder() {
    let app = NSApplication.shared
    let delegate = BuilderAppDelegate()
    app.setActivationPolicy(.accessory)
    app.delegate = delegate
    app.run()
}

if CommandLine.arguments.contains("--list-audio-inputs") { emitAudioDevices() }
else if CommandLine.arguments.contains("--dictate") {
    let index = CommandLine.arguments.firstIndex(of: "--audio-device")
    let uid = index.flatMap { $0 + 1 < CommandLine.arguments.count ? CommandLine.arguments[$0 + 1] : nil }
    let channelArgument = CommandLine.arguments.firstIndex(of: "--audio-channel")
    let channel = channelArgument.flatMap { $0 + 1 < CommandLine.arguments.count ? Int(CommandLine.arguments[$0 + 1]) : nil }
    runDictation(deviceUID: uid, channelIndex: channel)
}
else { launchBuilder() }
