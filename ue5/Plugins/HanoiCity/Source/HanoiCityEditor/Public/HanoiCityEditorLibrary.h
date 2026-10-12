#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "HanoiCityEditorLibrary.generated.h"

/** Editor helpers called from the Python setup scripts (unreal.HanoiCityEditorLibrary). */
UCLASS()
class HANOICITYEDITOR_API UHanoiCityEditorLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** Sets the georeference in Project Settings and writes it to Config/DefaultGame.ini. */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Editor")
	static bool SetCityOrigin(double Lat, double Lon, double HeightM);

	/** Runs one of the plugin's Python entry points (setup_project, import_content...). */
	UFUNCTION(BlueprintCallable, Category = "Hanoi|Editor")
	static bool RunPythonStep(const FString& ModuleName);
};
