#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif
[Setup]
AppId={{547EB19D-DF1F-4D15-9825-0BE6A530C426}
AppName=Макроквест
AppVersion={#AppVersion}
AppPublisher=Macroquest
AppPublisherURL=https://github.com/niiu/macroquest
DefaultDirName={localappdata}\Programs\Macroquest
DefaultGroupName=Макроквест
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
MinVersion=10.0
OutputDir=..\..\dist
OutputBaseFilename=Macroquest-{#AppVersion}-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\Macroquest.exe
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Создать ярлык на рабочем столе"; Flags: unchecked

[Files]
Source: "..\..\dist\portable\Macroquest.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\dist\portable\README.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Макроквест"; Filename: "{app}\Macroquest.exe"
Name: "{autodesktop}\Макроквест"; Filename: "{app}\Macroquest.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Macroquest.exe"; Description: "Открыть Макроквест в браузере"; Flags: nowait postinstall skipifsilent
