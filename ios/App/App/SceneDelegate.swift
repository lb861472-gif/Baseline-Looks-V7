import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var pendingAuthURL: URL?
    private var authDeliveryAttempts = 0

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        if let url = connectionOptions.urlContexts.first?.url, url.scheme == "baseline" {
            pendingAuthURL = url
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        deliverPendingAuthURLWhenReady()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url, url.scheme == "baseline" {
            pendingAuthURL = url
            authDeliveryAttempts = 0
            deliverPendingAuthURLWhenReady()
        }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    private func deliverPendingAuthURLWhenReady() {
        guard let url = pendingAuthURL else { return }
        guard let bridgeViewController = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridgeViewController.bridge?.webView else {
            retryAuthDelivery()
            return
        }

        let callback = url.absoluteString
        let jsonData = try? JSONSerialization.data(withJSONObject: [callback])
        guard let json = jsonData.flatMap({ String(data: $0, encoding: .utf8) }) else {
            pendingAuthURL = nil
            return
        }

        let script = """
        (function() {
            const callback = window.__handleBaselineAuthCallback;
            if (typeof callback !== 'function') { return false; }
            callback(\(json)[0]);
            return true;
        })();
        """

        webView.evaluateJavaScript(script) { [weak self] result, error in
            guard let self else { return }
            if error == nil, let delivered = result as? Bool, delivered {
                self.pendingAuthURL = nil
                self.authDeliveryAttempts = 0
            } else {
                self.retryAuthDelivery()
            }
        }
    }

    private func retryAuthDelivery() {
        guard pendingAuthURL != nil else { return }
        authDeliveryAttempts += 1
        guard authDeliveryAttempts <= 40 else {
            pendingAuthURL = nil
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            self?.deliverPendingAuthURLWhenReady()
        }
    }
}
