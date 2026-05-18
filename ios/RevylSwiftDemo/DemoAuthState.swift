import Foundation

private let loginMarkerKey = "REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN"
private let accessTokenKey = "REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN"
private let refreshTokenKey = "REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN"
private let uidTokenKey = "REVYL_SWIFT_DEMO_TEST_UID_TOKEN"

struct DemoSession {
    let accessExpiresAt: Date
    let uidExpiresAt: Date
}

enum DemoAuthStatus {
    case signedOut
    case invalid(reason: String)
    case authenticated(DemoSession)
}

final class DemoAuthState: ObservableObject {
    @Published private(set) var status: DemoAuthStatus

    private init(status: DemoAuthStatus) {
        self.status = status
    }

    static func fromLaunchConfiguration() -> DemoAuthState {
        let marker = launchValue(for: loginMarkerKey)
        guard marker?.lowercased() == "true" else {
            return DemoAuthState(status: .signedOut)
        }

        guard
            let accessToken = nonEmptyLaunchValue(for: accessTokenKey),
            let refreshToken = nonEmptyLaunchValue(for: refreshTokenKey),
            let uidToken = nonEmptyLaunchValue(for: uidTokenKey)
        else {
            return DemoAuthState(status: .invalid(reason: "A required Revyl Swift Demo launch variable is missing."))
        }

        guard !refreshToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return DemoAuthState(status: .invalid(reason: "The refresh-token launch variable is empty."))
        }

        guard let accessExp = jwtExpirationDate(accessToken) else {
            return DemoAuthState(status: .invalid(reason: "The access-token launch variable is not a JWT with an exp claim."))
        }

        guard let uidExp = jwtExpirationDate(uidToken) else {
            return DemoAuthState(status: .invalid(reason: "The uid-token launch variable is not a JWT with an exp claim."))
        }

        let now = Date()
        guard accessExp > now, uidExp > now else {
            return DemoAuthState(status: .invalid(reason: "One of the demo JWT launch variables is expired."))
        }

        return DemoAuthState(status: .authenticated(DemoSession(accessExpiresAt: accessExp, uidExpiresAt: uidExp)))
    }
}

private func nonEmptyLaunchValue(for key: String) -> String? {
    guard let value = launchValue(for: key)?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
        return nil
    }
    return value
}

private func launchValue(for key: String) -> String? {
    let environment = ProcessInfo.processInfo.environment
    if let value = environment[key] {
        return value
    }

    let args = CommandLine.arguments
    let keyedForms = ["-\(key)", key]
    for form in keyedForms {
        if let inline = args.first(where: { $0.hasPrefix("\(form)=") }) {
            return String(inline.dropFirst(form.count + 1))
        }

        guard let index = args.firstIndex(of: form) else {
            continue
        }
        let valueIndex = args.index(after: index)
        if args.indices.contains(valueIndex) {
            return args[valueIndex]
        }
    }

    return nil
}

private func jwtExpirationDate(_ token: String) -> Date? {
    let parts = token.split(separator: ".")
    guard parts.count >= 2 else {
        return nil
    }

    var payload = String(parts[1])
        .replacingOccurrences(of: "-", with: "+")
        .replacingOccurrences(of: "_", with: "/")
    while payload.count % 4 != 0 {
        payload.append("=")
    }

    guard
        let data = Data(base64Encoded: payload),
        let object = try? JSONSerialization.jsonObject(with: data),
        let dictionary = object as? [String: Any]
    else {
        return nil
    }

    let exp: TimeInterval
    if let number = dictionary["exp"] as? NSNumber {
        exp = number.doubleValue
    } else if let value = dictionary["exp"] as? TimeInterval {
        exp = value
    } else {
        return nil
    }

    return Date(timeIntervalSince1970: exp)
}
