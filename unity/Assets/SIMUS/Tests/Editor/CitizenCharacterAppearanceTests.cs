using System;
using NUnit.Framework;
using UnityEngine;
using UnityEditor;
using System.Linq;
namespace Simus.City.Tests {
 public sealed class CitizenCharacterAppearanceTests {
  [Test] public void AllSixteenVariantsSwitchInactiveHairAndGlasses() {
   var actor = new GameObject("Actor");
   try {
    var root = new GameObject("HAIR_ROOT"); root.transform.SetParent(actor.transform);
    for(int i=1;i<=16;i++) { var hair = new GameObject("HAIR_"+i.ToString("D2")+"_TEST"); hair.transform.SetParent(root.transform); hair.SetActive(false); }
    foreach(var name in new[]{"GLASSES_SQUARE","GLASSES_ROUND"}) { var glasses = new GameObject(name); glasses.transform.SetParent(actor.transform); glasses.SetActive(false); }
    for(int i=1;i<=16;i++) {
     CitizenCharacterAppearance.Apply(actor,"npc_"+i.ToString("D2"));
     for(int j=1;j<=16;j++) Assert.AreEqual(i==j,root.transform.GetChild(j-1).gameObject.activeInHierarchy);
     Assert.AreEqual(i==1,actor.transform.Find("GLASSES_SQUARE").gameObject.activeSelf);
     Assert.AreEqual(i==4,actor.transform.Find("GLASSES_ROUND").gameObject.activeSelf);
    }
   } finally { UnityEngine.Object.DestroyImmediate(actor); }
  }
  [Test] public void IndependentGlassesOverrideHairDefaults() {
   var actor = new GameObject("Actor");
   try {
    foreach(var name in new[]{"GLASSES_SQUARE","GLASSES_ROUND"}) { var part = new GameObject(name); part.transform.SetParent(actor.transform); }
    foreach(var hair in new[]{"npc_01","npc_04","npc_13","npc_16"}) foreach(var glasses in new[]{"none","square","round"}) {
     CitizenCharacterAppearance.Apply(actor,hair,glasses);
     Assert.AreEqual(glasses=="square",actor.transform.Find("GLASSES_SQUARE").gameObject.activeSelf);
     Assert.AreEqual(glasses=="round",actor.transform.Find("GLASSES_ROUND").gameObject.activeSelf);
    }
   } finally { UnityEngine.Object.DestroyImmediate(actor); }
  }
  [Test] public void RejectsUnsupportedGlasses() => Assert.Throws<FormatException>(() => CitizenCharacterAppearance.NormalizeGlasses("aviator","npc_01"));
  [Test] public void ImportedHappinessModelContainsAllHairAndIndependentGlasses() {
   var prefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/SIMUS/Art/characters/modular_hairfix_v001/models/SIMUS_Modular_Character_Happiness_Animations.fbx");
   Assert.IsNotNull(prefab);
   var actor = UnityEngine.Object.Instantiate(prefab);
   try {
    var nodes = actor.GetComponentsInChildren<Transform>(true);
    Assert.IsTrue(nodes.Any(n=>n.name=="HAIR_ROOT"));
    Assert.IsTrue(nodes.Any(n=>n.name=="GLASSES_SQUARE"));
    Assert.IsTrue(nodes.Any(n=>n.name=="GLASSES_ROUND"));
    for(int i=1;i<=16;i++) foreach(var glasses in new[]{"none","square","round"}) {
     var prefix = "HAIR_"+i.ToString("D2")+"_";
     CitizenCharacterAppearance.Apply(actor,"npc_"+i.ToString("D2"),glasses);
     var hair = nodes.Where(n=>n.name.StartsWith(prefix)).ToArray();
     // Bald is an optional empty helper; it has no required mesh.
     if(i!=13) Assert.IsNotEmpty(hair,"Missing imported hair " + i);
     foreach(var node in nodes.Where(n=>n.name.StartsWith("HAIR_") && n.name!="HAIR_ROOT"))
      Assert.AreEqual(node.name.StartsWith(prefix),node.gameObject.activeSelf);
     Assert.AreEqual(glasses=="square",nodes.First(n=>n.name=="GLASSES_SQUARE").gameObject.activeSelf);
     Assert.AreEqual(glasses=="round",nodes.First(n=>n.name=="GLASSES_ROUND").gameObject.activeSelf);
    }
   } finally { UnityEngine.Object.DestroyImmediate(actor); }
  }
  [TestCase("npc_00")][TestCase("npc_17")][TestCase("npc_1")][TestCase("NPC_01")]
  public void RejectsUnknownIds(string id) => Assert.Throws<FormatException>(() => CitizenCharacterAppearance.Normalize(id));
  [Test] public void MissingLegacyIdUsesDefault() => Assert.AreEqual("npc_01",CitizenCharacterAppearance.Normalize(null));
 }
}
