using System;
using Simus;
using Simus.City;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class CompletedMapFollowVerification
{
    private const string Pending = "SIMUS.CompletedFollow.Verification";
    private static Vector3 npcStart, cameraStart;
    private static float started;
    private static bool sampled;

    public static void Run()
    {
        EditorSceneManager.OpenScene(CompletedMapFollowSetup.ScenePath);
        SessionState.SetBool(Pending, true);
        EditorApplication.EnterPlaymode();
    }

    [InitializeOnLoadMethod]
    private static void Resume()
    {
        if (SessionState.GetBool(Pending, false)) EditorApplication.update += Tick;
    }

    private static void Tick()
    {
        if (!EditorApplication.isPlaying || Time.time < 0.2f) return;
        try
        {
            var patrol = UnityEngine.Object.FindFirstObjectByType<TestNpcPatrol>();
            var camera = UnityEngine.Object.FindFirstObjectByType<CityPreviewCamera>();
            Require(patrol != null && camera != null, "Missing patrol/camera");
            Require(camera.followTarget == patrol.transform, "Follow Target mismatch");
            Require(UnityEngine.Object.FindFirstObjectByType<CityStatePoller>() == null, "Unexpected server bootstrap");
            if (!sampled)
            {
                npcStart = patrol.transform.position; cameraStart = camera.transform.position;
                started = Time.time; sampled = true; return;
            }
            if (Time.time - started < 3f) return;
            Require(Vector3.Distance(npcStart, patrol.transform.position) > 2f, "NPC did not move");
            Require(Vector3.Distance(cameraStart, camera.transform.position) > 2f, "Camera did not follow");
            float error = Vector3.Distance(camera.target, patrol.transform.position + camera.followOffset);
            Require(error < 0.6f, "Camera lag too large: " + error);
            Require(Camera.main.orthographicSize < 18f, "Follow zoom reset to old minimum");
            Require(patrol.GetComponentsInChildren<SkinnedMeshRenderer>().Length > 0, "Character mesh absent");
            var animator = patrol.GetComponentInChildren<Animator>();
            Require(animator != null && animator.GetCurrentAnimatorStateInfo(0).loop &&
                animator.GetCurrentAnimatorStateInfo(0).normalizedTime > 1f, "Walk animation did not loop");
            if (SystemInfo.graphicsDeviceType != UnityEngine.Rendering.GraphicsDeviceType.Null)
                Capture(Camera.main);
            Debug.Log("COMPLETED_MAP_FOLLOW_VERIFIED: PlayMode NPC movement, Follow Target, smooth camera, zoom, mesh, animation, no server bootstrap; lag=" + error);
            Finish(0);
        }
        catch (Exception ex) { Debug.LogException(ex); Finish(1); }
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }

    private static void Capture(Camera camera)
    {
        var texture = new RenderTexture(1280, 720, 24);
        var image = new Texture2D(1280, 720, TextureFormat.RGB24, false);
        var previous = RenderTexture.active;
        var previousTarget = camera.targetTexture;
        try
        {
            camera.targetTexture = texture;
            camera.Render();
            RenderTexture.active = texture;
            image.ReadPixels(new Rect(0, 0, 1280, 720), 0, 0);
            image.Apply();
            System.IO.Directory.CreateDirectory("Logs");
            System.IO.File.WriteAllBytes("Logs/CompletedMapFollow.png", image.EncodeToPNG());
        }
        finally
        {
            camera.targetTexture = previousTarget;
            RenderTexture.active = previous;
            UnityEngine.Object.DestroyImmediate(image);
            texture.Release();
            UnityEngine.Object.DestroyImmediate(texture);
        }
    }

    private static void Finish(int code)
    {
        SessionState.SetBool(Pending, false);
        EditorApplication.update -= Tick;
        EditorApplication.Exit(code);
    }
}
