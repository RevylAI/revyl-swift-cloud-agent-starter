import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var authState: DemoAuthState

    private let launchVarKeys = [
        "REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN",
        "REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN",
        "REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN",
        "REVYL_SWIFT_DEMO_TEST_UID_TOKEN",
    ]

    var body: some View {
        ZStack {
            background

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    header
                    statusPanel
                    launchVarsCard
                    footer
                }
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .topLeading)
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Background

    private var background: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.04, green: 0.05, blue: 0.10),
                    Color(red: 0.03, green: 0.11, blue: 0.13),
                    Color(red: 0.02, green: 0.06, blue: 0.09),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Circle()
                .fill(statusColor.opacity(0.22))
                .frame(width: 420, height: 420)
                .blur(radius: 120)
                .offset(x: 150, y: -260)

            Circle()
                .fill(Color(red: 0.35, green: 0.30, blue: 0.95).opacity(0.16))
                .frame(width: 380, height: 380)
                .blur(radius: 110)
                .offset(x: -170, y: 320)
        }
        .ignoresSafeArea()
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: "shippingbox.fill")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 46, height: 46)
                    .background(
                        LinearGradient(
                            colors: [Color(red: 0.49, green: 0.23, blue: 0.93), Color(red: 0.20, green: 0.60, blue: 0.86)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        in: RoundedRectangle(cornerRadius: 12, style: .continuous)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text("Revyl Swift Demo")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("Vercel Sandbox proof loop")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                        .foregroundStyle(.white.opacity(0.55))
                }
            }
        }
    }

    // MARK: - Status

    private var statusColor: Color {
        switch authState.status {
        case .signedOut: Color(red: 0.96, green: 0.72, blue: 0.25)
        case .invalid: Color(red: 1.0, green: 0.36, blue: 0.32)
        case .authenticated: Color(red: 0.35, green: 0.88, blue: 0.67)
        }
    }

    @ViewBuilder
    private var statusPanel: some View {
        switch authState.status {
        case .signedOut:
            panel(
                icon: "lock.fill",
                eyebrow: "Signed out demo state",
                title: "No Revyl launch vars were injected.",
                detail: "Start a fresh Revyl device session with the four configured launch vars to unlock the proof screen."
            )
        case .invalid(let reason):
            panel(
                icon: "exclamationmark.triangle.fill",
                eyebrow: "Launch vars rejected",
                title: "The demo saw Revyl launch vars, but they were not usable.",
                detail: reason
            )
        case .authenticated(let session):
            panel(
                icon: "checkmark.seal.fill",
                eyebrow: "Authenticated cloud-agent proof",
                title: "The Revyl Swift Demo shows an authenticated cloud-agent proof screen.",
                detail: "Access token expires \(session.accessExpiresAt.formatted(date: .omitted, time: .shortened)); uid token expires \(session.uidExpiresAt.formatted(date: .omitted, time: .shortened))."
            )
        }
    }

    private func panel(icon: String, eyebrow: String, title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(statusColor)
                    .frame(width: 34, height: 34)
                    .background(statusColor.opacity(0.16), in: RoundedRectangle(cornerRadius: 9, style: .continuous))

                Text(eyebrow.uppercased())
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .tracking(1.1)
                    .foregroundStyle(statusColor)
            }

            Text(title)
                .font(.system(size: 24, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
                .fixedSize(horizontal: false, vertical: true)

            Text(detail)
                .font(.system(size: 15, weight: .regular, design: .rounded))
                .foregroundStyle(.white.opacity(0.72))
                .fixedSize(horizontal: false, vertical: true)
                .lineSpacing(3)
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [statusColor.opacity(0.75), statusColor.opacity(0.15)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.2
                )
        )
        .shadow(color: statusColor.opacity(0.18), radius: 24, y: 10)
    }

    // MARK: - Launch vars

    private var isAuthenticated: Bool {
        if case .authenticated = authState.status { return true }
        return false
    }

    private var launchVarsCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Image(systemName: "key.horizontal.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.55))
                Text("Launch vars expected")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.85))
            }
            .padding(.bottom, 8)

            ForEach(Array(launchVarKeys.enumerated()), id: \.element) { index, key in
                HStack(spacing: 10) {
                    Circle()
                        .fill(isAuthenticated ? statusColor : Color.white.opacity(0.25))
                        .frame(width: 7, height: 7)
                    Text(key)
                        .font(.system(size: 12.5, weight: .medium, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 9)

                if index < launchVarKeys.count - 1 {
                    Divider().overlay(Color.white.opacity(0.08))
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.white.opacity(0.09), lineWidth: 1)
        )
    }

    // MARK: - Footer

    private var footer: some View {
        HStack(spacing: 6) {
            Image(systemName: "sparkles")
                .font(.system(size: 11))
            Text("Built remotely by Revyl · driven from a Vercel Sandbox")
                .font(.system(size: 12, weight: .medium, design: .rounded))
        }
        .foregroundStyle(.white.opacity(0.38))
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, 4)
    }
}

#Preview {
    ContentView()
        .environmentObject(DemoAuthState.fromLaunchConfiguration())
}
