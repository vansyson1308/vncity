#include "HanoiCityEditorLibrary.h"
#include "HanoiCitySettings.h"
#include "IPythonScriptPlugin.h"

bool UHanoiCityEditorLibrary::SetCityOrigin(double Lat, double Lon, double HeightM)
{
	UHanoiCitySettings* Settings = GetMutableDefault<UHanoiCitySettings>();
	Settings->OriginLat = Lat;
	Settings->OriginLon = Lon;
	Settings->OriginHeightM = HeightM;
	return Settings->TryUpdateDefaultConfigFile();
}

bool UHanoiCityEditorLibrary::RunPythonStep(const FString& ModuleName)
{
	IPythonScriptPlugin* Python = IPythonScriptPlugin::Get();
	if (!Python || !Python->IsPythonAvailable())
	{
		UE_LOG(LogHanoi, Error, TEXT("Python is not available; enable the Python Editor Script Plugin"));
		return false;
	}
	// ModuleName is spliced into Python source: accept plain identifiers only.
	bool bIdentifier = !ModuleName.IsEmpty() && !FChar::IsDigit(ModuleName[0]);
	for (const TCHAR Ch : ModuleName)
	{
		bIdentifier = bIdentifier && (FChar::IsAlnum(Ch) || Ch == TEXT('_'));
	}
	if (!bIdentifier)
	{
		UE_LOG(LogHanoi, Error, TEXT("RunPythonStep: '%s' is not a Python module name"), *ModuleName);
		return false;
	}
	// Reload the helper modules too, so edits to any script take effect without restarting the editor.
	const FString Command = FString::Printf(
		TEXT("import importlib, sys; [importlib.reload(sys.modules[_n]) for _n in ('hanoi_geo', 'hanoi_common', 'import_content', 'import_city', 'import_pcg_points', 'setup_project') if _n in sys.modules]; import %s; %s.main([])"),
		*ModuleName, *ModuleName);
	return Python->ExecPythonCommand(*Command);
}
