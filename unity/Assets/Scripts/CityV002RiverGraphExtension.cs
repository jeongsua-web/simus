using System;
using System.Linq;
using UnityEngine;
namespace Simus
{
    /// <summary>Serialized extension keeps river routes after the base Phase 5 setup is reapplied.</summary>
    public sealed class CityV002RiverGraphExtension : MonoBehaviour
    {
        public CityV002PedestrianGraph.Node[] nodes;
        public CityV002PedestrianGraph.Edge[] edges;
        public string[] fromIds, toIds;
        public void Apply(CityV002PedestrianGraph graph)
        {
            if(nodes==null||edges==null)return;
            graph.nodes=graph.nodes.Where(n=>!n.id.StartsWith("RIVER_")).Concat(nodes).ToArray();
            var ids=graph.nodes.Select((n,i)=>new{n.id,i}).ToDictionary(n=>n.id,n=>n.i);
            for(int i=0;i<edges.Length;i++){edges[i].from=ids[fromIds[i]];edges[i].to=ids[toIds[i]];}
            graph.edges=graph.edges.Where(e=>!e.id.StartsWith("RIVER_")).Concat(edges).ToArray();
        }
    }
}
