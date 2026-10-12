using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;

public static class NpcFollowWebGLBuild
{
    [MenuItem("SIMUS/WebGL/Build NPC follow preview")]
    public static void Build()
    {
        if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL, BuildTarget.WebGL))
            throw new InvalidOperationException("Unity WebGL Build Support is required.");
        if (!File.Exists(CompletedMapFollowSetup.ScenePath))
            throw new InvalidOperationException("NPC follow test scene is missing. Generate it explicitly before building.");
        var output = Environment.GetEnvironmentVariable("SIMUS_PREVIEW_OUTPUT") ?? "Builds/npc_follow_preview";
        var template = PlayerSettings.WebGL.template;
        var compression = PlayerSettings.WebGL.compressionFormat;
        try
        {
            PlayerSettings.WebGL.template = "PROJECT:simus_preview";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { CompletedMapFollowSetup.ScenePath },
                locationPathName = output, target = BuildTarget.WebGL, options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded)
                throw new InvalidOperationException("NPC follow WebGL build failed: " + report.summary.result);
            File.WriteAllText(Path.Combine(output, "build.json"),
                "{\"kind\":\"npc-follow-preview\",\"protocol_version\":1,\"map_version\":null,\"scene\":\"CompletedMapNpcFollow\",\"exhibition_ready\":false}\n");
        }
        finally
        {
            PlayerSettings.WebGL.template = template;
            PlayerSettings.WebGL.compressionFormat = compression;
        }
    }
}
