import SwiftUI
import WebKit

struct DashboardWebView: UIViewRepresentable {
    enum State {
        case started
        case finished
        case failed(String)
    }

    var url: URL
    var readAccessURL: URL?
    var reloadToken: UUID
    var onStateChange: (State) -> Void = { _ in }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.customUserAgent = userAgent()

        loadRequest(in: webView, context: context)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.parent = self
        let shouldReload = context.coordinator.lastReloadToken != reloadToken
        let urlHasChanged = context.coordinator.currentURL != url
        let readAccessChanged = context.coordinator.currentReadAccessURL != readAccessURL

        if shouldReload || urlHasChanged || readAccessChanged {
            loadRequest(in: uiView, context: context)
        }
    }

    private func loadRequest(in webView: WKWebView, context: Context) {
        context.coordinator.lastReloadToken = reloadToken
        context.coordinator.currentURL = url
        context.coordinator.currentReadAccessURL = readAccessURL

        if url.isFileURL {
            let accessURL = readAccessURL ?? url.deletingLastPathComponent()
            webView.loadFileURL(url, allowingReadAccessTo: accessURL)
        } else {
            let request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
            webView.load(request)
        }
    }

    private func userAgent() -> String {
        let systemVersion = UIDevice.current.systemVersion
        return "Dashboard3D-iOS/\(systemVersion)"
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var parent: DashboardWebView
        var lastReloadToken: UUID
        var currentURL: URL?
        var currentReadAccessURL: URL?

        init(parent: DashboardWebView) {
            self.parent = parent
            self.lastReloadToken = parent.reloadToken
            self.currentURL = parent.url
            self.currentReadAccessURL = parent.readAccessURL
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.onStateChange(.started)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.onStateChange(.finished)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.onStateChange(.failed(error.localizedDescription))
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            parent.onStateChange(.failed(error.localizedDescription))
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            completionHandler()
        }
    }
}
