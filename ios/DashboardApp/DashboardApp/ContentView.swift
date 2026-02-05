import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var viewModel: DashboardViewModel

    var body: some View {
        ZStack {
            if let destinationURL = viewModel.destinationURL {
                DashboardWebView(
                    url: destinationURL,
                        readAccessURL: viewModel.destinationReadAccessURL,
                    reloadToken: viewModel.reloadToken,
                    onStateChange: viewModel.handle(webState:)
                )
                .ignoresSafeArea(edges: .bottom)
            }

            if viewModel.destinationURL == nil && viewModel.errorMessage == nil {
                ProgressView("Preparando dashboard…")
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            if let errorMessage = viewModel.errorMessage {
                VStack(spacing: 12) {
                    Text("No se pudo cargar el dashboard")
                        .font(.headline)
                    Text(errorMessage)
                        .multilineTextAlignment(.center)
                        .font(.subheadline)
                    Button("Reintentar") {
                        viewModel.retry()
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
                .frame(maxWidth: 320)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding()
            }

            if viewModel.isLoading {
                ProgressView()
                    .progressViewStyle(.circular)
                    .padding()
                    .background(.ultraThinMaterial, in: Circle())
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .padding(24)
            }
        }
        .task {
            await viewModel.loadConfigIfNeeded()
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(DashboardViewModel.preview())
}
