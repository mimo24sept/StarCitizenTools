# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_submodules

hiddenimports = ['tkinter', '_tkinter', 'customtkinter']
hiddenimports += collect_submodules('tkinter')


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[('C:\\Users\\olivi\\AppData\\Local\\Programs\\Python\\Python314\\DLLs\\tcl86t.dll', '.'), ('C:\\Users\\olivi\\AppData\\Local\\Programs\\Python\\Python314\\DLLs\\tk86t.dll', '.')],
    datas=[('C:\\Users\\olivi\\AppData\\Local\\Programs\\Python\\Python314\\tcl\\tcl8.6', 'tcl\\tcl8.6'), ('C:\\Users\\olivi\\AppData\\Local\\Programs\\Python\\Python314\\tcl\\tk8.6', 'tcl\\tk8.6')],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='StarCitizenCraftTracker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
