import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        if let context = connectionOptions.urlContexts.first {
            handleAuthURL(context.url)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
        for context in URLContexts {
            handleAuthURL(context.url)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
    private func handleAuthURL(_ url: URL) {
        guard url.scheme == "baseline", let webView = (window?.rootViewController as? CAPBridgeViewController)?.bridge?.webView else { return }
        let fragment = url.fragment ?? ""
        guard !fragment.isEmpty else { return }
        let callbackURL = url.absoluteString
        let escaped = String(data: try! JSONSerialization.data(withJSONObject: callbackURL), encoding: .utf8)!
        webView.evaluateJavaScript("window.__baselineHandleAuthCallback && window.__baselineHandleAuthCallback(" + escaped + ");", completionHandler: nil)
    }
}
