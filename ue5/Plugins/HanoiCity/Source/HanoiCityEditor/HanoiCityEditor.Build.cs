using UnrealBuildTool;

public class HanoiCityEditor : ModuleRules
{
	public HanoiCityEditor(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core", "CoreUObject", "Engine", "HanoiCityRuntime"
		});
		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"UnrealEd", "ToolMenus", "Slate", "SlateCore", "Projects", "DeveloperSettings", "PythonScriptPlugin"
		});
	}
}
