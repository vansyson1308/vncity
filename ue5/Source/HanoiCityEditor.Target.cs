using UnrealBuildTool;

public class HanoiCityEditorTarget : TargetRules
{
	public HanoiCityEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("HanoiCity");
	}
}
