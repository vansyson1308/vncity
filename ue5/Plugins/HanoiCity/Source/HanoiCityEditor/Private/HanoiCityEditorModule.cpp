#include "HanoiCityEditorLibrary.h"
#include "Modules/ModuleManager.h"
#include "ToolMenus.h"

#define LOCTEXT_NAMESPACE "HanoiCityEditor"

/** Adds Tools > Hanoi City menu entries that run the Python setup steps. */
class FHanoiCityEditorModule : public IModuleInterface
{
public:
	virtual void StartupModule() override
	{
		UToolMenus::RegisterStartupCallback(FSimpleMulticastDelegate::FDelegate::CreateRaw(this, &FHanoiCityEditorModule::RegisterMenus));
	}

	virtual void ShutdownModule() override
	{
		UToolMenus::UnRegisterStartupCallback(this);
		UToolMenus::UnregisterOwner(this);
	}

private:
	void RegisterMenus()
	{
		FToolMenuOwnerScoped OwnerScoped(this);
		UToolMenu* Menu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Tools");
		FToolMenuSection& Section = Menu->FindOrAddSection("HanoiCity", LOCTEXT("Section", "Hanoi City"));
		const auto Add = [&Section](FName Name, const FText& Label, const FText& Tip, const TCHAR* Module)
		{
			const FString ModuleName(Module);
			Section.AddMenuEntry(Name, Label, Tip, FSlateIcon(),
				FUIAction(FExecuteAction::CreateLambda([ModuleName]() { UHanoiCityEditorLibrary::RunPythonStep(ModuleName); })));
		};
		Add("HanoiSetup", LOCTEXT("Setup", "Hanoi: Run Full Setup"), LOCTEXT("SetupTip", "Codegen data, DataTables, city tiles, traffic graph, PCG points"), TEXT("setup_project"));
		Add("HanoiContent", LOCTEXT("Content", "Hanoi: Reimport Game Content"), LOCTEXT("ContentTip", "game/content -> DataTables"), TEXT("import_content"));
		Add("HanoiCity", LOCTEXT("City", "Hanoi: Import City Tiles"), LOCTEXT("CityTip", "out/<city>/tiles/*.glb -> static mesh actors"), TEXT("import_city"));
		Add("HanoiPoints", LOCTEXT("Points", "Hanoi: Import PCG Points"), LOCTEXT("PointsTip", "out/<city>/pcg/*.csv -> DataTables + instanced meshes"), TEXT("import_pcg_points"));
	}
};

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FHanoiCityEditorModule, HanoiCityEditor);
