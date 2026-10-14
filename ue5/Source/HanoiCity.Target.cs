using UnrealBuildTool;

public class HanoiCityTarget : TargetRules
{
	public HanoiCityTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("HanoiCity");
	}
}
