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
	const FString Command = FString::Printf(TEXT("import importlib, %s; importlib.reload(%s); %s.main([])"), *ModuleName, *ModuleName, *ModuleName);
	return Python->ExecPythonCommand(*Command);
}
