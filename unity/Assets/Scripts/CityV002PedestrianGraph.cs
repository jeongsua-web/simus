using System;
using System.Collections.Generic;
using UnityEngine;

namespace Simus
{
    /// <summary>Serialized copy of the approved v002 graph. No exhibition/server route contract.</summary>
    public sealed class CityV002PedestrianGraph : MonoBehaviour
    {
        [Serializable] public sealed class Node { public string id; public Vector3 position; }
        [Serializable] public sealed class Edge
        {
            public string id, kind;
            public int from, to;
            public float width;
            public Vector3[] points;
            public float Length
            {
                get { float result = 0; for (int i = 1; i < points.Length; i++) result += Vector3.Distance(points[i - 1], points[i]); return result; }
            }
        }
        public string layoutSha256;
        public string mapVersion;
        public string pathVersion;
        public Node[] nodes = Array.Empty<Node>();
        public Edge[] edges = Array.Empty<Edge>();

        public bool TryRoute(string start, string end, out Vector3[] points, out string[] edgeIds, out float length)
        {
            points = Array.Empty<Vector3>(); edgeIds = Array.Empty<string>(); length = 0;
            int source = Array.FindIndex(nodes, n => n.id == start), target = Array.FindIndex(nodes, n => n.id == end);
            if (source < 0 || target < 0) return false;
            var distance = new float[nodes.Length]; var visited = new bool[nodes.Length];
            var previousNode = new int[nodes.Length]; var previousEdge = new int[nodes.Length];
            for (int i = 0; i < nodes.Length; i++) { distance[i] = float.PositiveInfinity; previousNode[i] = previousEdge[i] = -1; }
            distance[source] = 0;
            for (int iteration = 0; iteration < nodes.Length; iteration++)
            {
                int current = -1; float closest = float.PositiveInfinity;
                for (int i = 0; i < nodes.Length; i++) if (!visited[i] && distance[i] < closest) { current = i; closest = distance[i]; }
                if (current < 0) break;
                if (current == target) break;
                visited[current] = true;
                for (int i = 0; i < edges.Length; i++)
                {
                    var edge = edges[i]; int next = edge.from == current ? edge.to : edge.to == current ? edge.from : -1;
                    if (next < 0 || visited[next]) continue;
                    float candidate = distance[current] + edge.Length;
                    if (candidate >= distance[next]) continue;
                    distance[next] = candidate; previousNode[next] = current; previousEdge[next] = i;
                }
            }
            if (float.IsInfinity(distance[target])) return false;
            var pathEdges = new List<int>(); var pathNodes = new List<int>(); int cursor = target;
            while (cursor != source)
            {
                if (previousEdge[cursor] < 0) return false;
                pathEdges.Add(previousEdge[cursor]); pathNodes.Add(previousNode[cursor]); cursor = previousNode[cursor];
            }
            pathEdges.Reverse(); pathNodes.Reverse();
            var result = new List<Vector3> { nodes[source].position }; var ids = new List<string>();
            for (int i = 0; i < pathEdges.Count; i++)
            {
                var edge = edges[pathEdges[i]]; ids.Add(edge.id);
                bool forward = edge.from == pathNodes[i];
                for (int p = 0; p < edge.points.Length; p++)
                {
                    var point = edge.points[forward ? p : edge.points.Length - 1 - p];
                    if ((point - result[result.Count - 1]).sqrMagnitude > .000001f) result.Add(point);
                }
            }
            points = result.ToArray(); edgeIds = ids.ToArray(); length = distance[target]; return true;
        }
    }
}
