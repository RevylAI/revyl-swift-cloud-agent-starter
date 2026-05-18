import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var authState: DemoAuthState

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(red: 0.07, green: 0.09, blue: 0.12), Color(red: 0.03, green: 0.16, blue: 0.15)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 22) {
                Text("Revyl Swift Demo")
                    .font(.system(size: 38, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)

                statusPanel

                VStack(alignment: .leading, spacing: 8) {
                    Text("Launch vars expected")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN")
                    Text("REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN")
                    Text("REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN")
                    Text("REVYL_SWIFT_DEMO_TEST_UID_TOKEN")
                }
                .font(.system(size: 13, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.74))

                Spacer()
            }
            .padding(28)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    @ViewBuilder
    private var statusPanel: some View {
        switch authState.status {
        case .signedOut:
            panel(
                eyebrow: "Signed out demo state",
                title: "No Revyl launch vars were injected.",
                detail: "Start a fresh Revyl device session with the four configured launch vars to unlock the proof screen.",
                color: Color(red: 0.96, green: 0.72, blue: 0.25)
            )
        case .invalid(let reason):
            panel(
                eyebrow: "Launch vars rejected",
                title: "The demo saw Revyl launch vars, but they were not usable.",
                detail: reason,
                color: Color(red: 1.0, green: 0.36, blue: 0.32)
            )
        case .authenticated(let session):
            panel(
                eyebrow: "Authenticated cloud-agent proof",
                title: "The Revyl Swift Demo shows an authenticated cloud-agent proof screen.",
                detail: "Access token expires \(session.accessExpiresAt.formatted(date: .omitted, time: .shortened)); uid token expires \(session.uidExpiresAt.formatted(date: .omitted, time: .shortened)).",
                color: Color(red: 0.35, green: 0.88, blue: 0.67)
            )
        }
    }

    private func panel(eyebrow: String, title: String, detail: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(eyebrow.uppercased())
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(color)
            Text(title)
                .font(.system(size: 25, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)
            Text(detail)
                .font(.system(size: 16, weight: .regular, design: .rounded))
                .foregroundStyle(.white.opacity(0.76))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(20)
        .background(.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(color.opacity(0.65), lineWidth: 1)
        )
    }
}

#Preview {
    ContentView()
        .environmentObject(DemoAuthState.fromLaunchConfiguration())
}

