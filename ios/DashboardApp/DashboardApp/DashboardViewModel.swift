import Foundation

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var destinationURL: URL?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var reloadToken = UUID()

    private let defaultServerAddress = "10.3.29.30:8192"
    private let entryPoint = "J3DDashBoard.html"

    var canReload: Bool {
        destinationURL != nil && !isLoading
    }

    func loadConfigIfNeeded() async {
        guard destinationURL == nil else { return }
        await loadConfig()
    }

    func retry() {
        Task {
            await loadConfig(forceReload: true)
        }
    }

    func reloadWebContent() {
        guard destinationURL != nil else { return }
        reloadToken = UUID()
        isLoading = true
    }

    func handle(webState: DashboardWebView.State) {
        switch webState {
        case .started:
            isLoading = true
            errorMessage = nil
        case .finished:
            isLoading = false
        case .failed(let message):
            isLoading = false
            errorMessage = message
        }
    }

    static func preview() -> DashboardViewModel {
        let model = DashboardViewModel()
        model.destinationURL = URL(string: "http://10.3.29.30:8192/J3DDashBoard.html")
        return model
    }
}

private extension DashboardViewModel {
    func loadConfig(forceReload: Bool = false) async {
        if forceReload {
            destinationURL = nil
        }

        isLoading = true
        errorMessage = nil

        do {
            let configContents = try await Self.ConfigReader.loadDashConfig()
            let serverAddress = Self.ConfigReader.serverAddress(from: configContents) ?? defaultServerAddress
            guard let url = URL(string: normalized(server: serverAddress)) else {
                throw ConfigError.invalidAddress(serverAddress)
            }
            destinationURL = url
            errorMessage = nil
            isLoading = false
        } catch {
            isLoading = false
            errorMessage = error.localizedDescription
        }
    }

    func normalized(server: String) -> String {
        let trimmed = server.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return "http://\(defaultServerAddress)/\(entryPoint)"
        }

        if trimmed.lowercased().hasPrefix("http://") || trimmed.lowercased().hasPrefix("https://") {
            if trimmed.hasSuffix(entryPoint) {
                return trimmed
            }
            let separator = trimmed.hasSuffix("/") ? "" : "/"
            return trimmed + separator + entryPoint
        }

        let prefix = "http://"
        let separator = trimmed.hasSuffix("/") ? "" : "/"
        return prefix + trimmed + separator + entryPoint
    }

    enum ConfigError: LocalizedError {
        case missingFile
        case invalidAddress(String)

        var errorDescription: String? {
            switch self {
            case .missingFile:
                return "No se encontró el archivo Dash.cfg dentro del bundle."
            case .invalidAddress(let value):
                return "La dirección del servidor no es válida: \(value)"
            }
        }
    }

    struct ConfigReader {
        static func loadDashConfig() async throws -> String {
            guard let configURL = Bundle.main.url(forResource: "Dash", withExtension: "cfg") else {
                throw DashboardViewModel.ConfigError.missingFile
            }
            return try await Task.detached(priority: .userInitiated) {
                try String(contentsOf: configURL, encoding: .utf8)
            }.value
        }

        static func serverAddress(from contents: String) -> String? {
            contents
                .split(whereSeparator: \.isNewline)
                .compactMap { line -> (String, String)? in
                    let trimmedLine = line.trimmingCharacters(in: .whitespaces)
                    guard !trimmedLine.isEmpty, !trimmedLine.hasPrefix("#"), !trimmedLine.hasPrefix("//") else { return nil }
                    let fragments = trimmedLine.split(separator: "=", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
                    guard fragments.count == 2 else { return nil }
                    return (fragments[0].lowercased(), fragments[1])
                }
                .first { key, _ in key == "ip_server" }
                .map { $0.1 }
        }
    }
}
