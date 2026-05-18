import SwiftUI

@main
struct RevylSwiftDemoApp: App {
    @StateObject private var authState = DemoAuthState.fromLaunchConfiguration()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authState)
        }
    }
}

