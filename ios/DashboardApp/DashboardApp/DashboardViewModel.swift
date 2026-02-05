import Foundation

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var destinationURL: URL?
    @Published private(set) var destinationReadAccessURL: URL?
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?
    @Published var reloadToken = UUID()

    var canReload: Bool {
        destinationURL != nil && !isLoading
    }

    func loadConfigIfNeeded() async {
        guard destinationURL == nil else { return }
        await loadDashboardEntryPoint()
    }

    func retry() {
        Task {
            await loadDashboardEntryPoint(forceReload: true)
        }
    }

    func reloadWebContent() {
        guard destinationURL != nil else { return }
        reloadToken = UUID()
        isLoading = true
        errorMessage = nil
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
        model.destinationURL = URL(fileURLWithPath: "/tmp/J3DDashBoard.html")
        model.destinationReadAccessURL = URL(fileURLWithPath: "/tmp")
        return model
    }
}

private extension DashboardViewModel {
    enum DashboardError: LocalizedError {
        case missingEntryPoint

        var errorDescription: String? {
            switch self {
            case .missingEntryPoint:
                return "No se encontró J3DDashBoard.html dentro del bundle."
            }
        }
    }

    func loadDashboardEntryPoint(forceReload: Bool = false) async {
        if forceReload {
            destinationURL = nil
            destinationReadAccessURL = nil
        }

        isLoading = true
        errorMessage = nil

        do {
            let entryURL = try locateEntryPoint()
            destinationURL = entryURL
            destinationReadAccessURL = Bundle.main.bundleURL
            isLoading = false
        } catch {
            isLoading = false
            errorMessage = error.localizedDescription
        }
    }

    func locateEntryPoint() throws -> URL {
        guard let url = Bundle.main.url(forResource: "J3DDashBoard", withExtension: "html") else {
            throw DashboardError.missingEntryPoint
        }
        return url
    }
}
