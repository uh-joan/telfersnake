using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Telfer.EditorTools
{
    /// <summary>
    /// One-click project setup and builds. Everything in the game is built in code at runtime by
    /// GameRoot, so the scene is empty: it only has to exist.
    ///   Unity -batchmode -projectPath unity -executeMethod Telfer.EditorTools.Builder.WebGL -quit
    /// </summary>
    public static class Builder
    {
        const string Scene = "Assets/Telfersnake/Scenes/Main.unity";
        /// <summary>Quit the editor when a batch build finishes (false when driving a resident editor).</summary>
        public static bool ExitWhenDone = true;

        [MenuItem("Telfersnake/Set Up Project")]
        public static void Setup()
        {
            if (!File.Exists(Scene))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Scene));
                var s = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                EditorSceneManager.SaveScene(s, Scene);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(Scene, true) };
            PlayerSettings.companyName = "Telferscot";
            PlayerSettings.productName = "Telfersnake HD";
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.defaultScreenWidth = 1600;
            PlayerSettings.defaultScreenHeight = 900;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.runInBackground = true;
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Brotli;
            PlayerSettings.WebGL.decompressionFallback = true;
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.template = "PROJECT:Telfersnake";
            AssetDatabase.SaveAssets();
            Debug.Log("[Telfersnake] project set up");
        }

        [MenuItem("Telfersnake/Open Main Scene")]
        public static void OpenMain()
        {
            Setup();
            EditorSceneManager.OpenScene(Scene);
        }

        [MenuItem("Telfersnake/Build/WebGL")]
        public static void WebGL() => Build(BuildTarget.WebGL, "Builds/WebGL");

        [MenuItem("Telfersnake/Build/macOS")]
        public static void Mac() => Build(BuildTarget.StandaloneOSX, "Builds/macOS/TelfersnakeHD.app");

        static void Build(BuildTarget target, string path)
        {
            Setup();
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { Scene },
                locationPathName = path,
                target = target,
                options = BuildOptions.None,
            });
            var s = report.summary;
            Debug.Log($"[Telfersnake] build {s.result}: {s.totalErrors} errors, {s.totalSize / (1024 * 1024)} MB, {s.totalTime} → {path}");
            if (Application.isBatchMode && ExitWhenDone) EditorApplication.Exit(s.result == BuildResult.Succeeded ? 0 : 1);
        }
    }
}
