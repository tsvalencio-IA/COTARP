#define MyAppName "Transcritor IA"
#define MyAppVersion "1.2.0"
#define MyAppPublisher "thIAguinho Soluções Digitais"
#define MyAppExeName "TranscritorIA.exe"

[Setup]
AppId={{D83C71C4-A4BE-4D69-9FC8-59D3C165918D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Transcritor IA
DefaultGroupName={#MyAppName}
OutputDir=installer_out
OutputBaseFilename=TranscritorIA-Setup-v1.2.0
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
UsePreviousAppDir=yes

[Files]
Source: "dist\TranscritorIA.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\TranscritorIA-WhatsApp-Extension\*"; DestDir: "{app}\WhatsAppExtension"; Flags: ignoreversion recursesubdirs createallsubdirs

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos:"; Flags: unchecked

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autoprograms}\Transcritor IA - Extensão WhatsApp"; Filename: "{app}\WhatsAppExtension"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Classes\Applications\{#MyAppExeName}\shell\open\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.mp3\shell\TranscritorIA"; ValueType: string; ValueData: "Transcrever com Transcritor IA"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.mp3\shell\TranscritorIA\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.m4a\shell\TranscritorIA"; ValueType: string; ValueData: "Transcrever com Transcritor IA"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.m4a\shell\TranscritorIA\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.ogg\shell\TranscritorIA"; ValueType: string; ValueData: "Transcrever com Transcritor IA"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.ogg\shell\TranscritorIA\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.opus\shell\TranscritorIA"; ValueType: string; ValueData: "Transcrever com Transcritor IA"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.opus\shell\TranscritorIA\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.wav\shell\TranscritorIA"; ValueType: string; ValueData: "Transcrever com Transcritor IA"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.wav\shell\TranscritorIA\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.mp4\shell\TranscritorIA"; ValueType: string; ValueData: "Transcrever com Transcritor IA"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.mp4\shell\TranscritorIA\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.webm\shell\TranscritorIA"; ValueType: string; ValueData: "Transcrever com Transcritor IA"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\SystemFileAssociations\.webm\shell\TranscritorIA\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir Transcritor IA"; Flags: nowait postinstall skipifsilent
Filename: "explorer.exe"; Parameters: """{app}\WhatsAppExtension"""; Description: "Abrir pasta da extensão do WhatsApp Web"; Flags: postinstall skipifsilent unchecked

[Code]
function GetOldUninstallString(): String;
var S: String;
begin
  Result := '';
  if RegQueryStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{D83C71C4-A4BE-4D69-9FC8-59D3C165918D}_is1', 'UninstallString', S) then
    Result := S
  else if RegQueryStringValue(HKLM64, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{D83C71C4-A4BE-4D69-9FC8-59D3C165918D}_is1', 'UninstallString', S) then
    Result := S;
end;

function InitializeSetup(): Boolean;
var
  UninstallString: String;
  ResultCode: Integer;
begin
  Result := True;
  UninstallString := GetOldUninstallString();
  if UninstallString <> '' then
  begin
    StringChangeEx(UninstallString, '"', '', True);
    Exec(UninstallString, '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
