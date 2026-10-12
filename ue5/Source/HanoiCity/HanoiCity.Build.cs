using UnrealBuildTool;

// Thin primary game module. Gameplay systems live in Plugins/HanoiCity (HanoiCityRuntime);
// this module exists so the project is a C++ project and the editor can build the plugin.
public class HanoiCity : ModuleRules
{
	public HanoiCity(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "HanoiCityRuntime" });
	}
}
