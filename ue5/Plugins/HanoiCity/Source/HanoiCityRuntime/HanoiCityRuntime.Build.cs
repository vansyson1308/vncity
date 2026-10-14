using UnrealBuildTool;

public class HanoiCityRuntime : ModuleRules
{
	public HanoiCityRuntime(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicIncludePaths.Add(ModuleDirectory + "/Public/Generated");
		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core", "CoreUObject", "Engine", "DeveloperSettings"
		});
		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Json", "JsonUtilities", "HTTP"
		});
	}
}
