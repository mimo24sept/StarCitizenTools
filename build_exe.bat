@echo off
setlocal

set "PY_TCL=C:\Users\olivi\AppData\Local\Programs\Python\Python314\tcl"
set "PY_DLL=C:\Users\olivi\AppData\Local\Programs\Python\Python314\DLLs"

py -m ensurepip --upgrade
py -m pip install --upgrade pip
py -m pip install --upgrade pyinstaller
py -m PyInstaller --noconfirm --clean --onefile --windowed --name StarCitizenCraftTracker ^
  --hidden-import=tkinter ^
  --collect-submodules=tkinter ^
  --add-data "%PY_TCL%\tcl8.6;tcl\tcl8.6" ^
  --add-data "%PY_TCL%\tk8.6;tcl\tk8.6" ^
  --add-binary "%PY_DLL%\tcl86t.dll;." ^
  --add-binary "%PY_DLL%\tk86t.dll;." ^
  app.py

echo.
echo Build termine. Le .exe devrait etre dans dist\StarCitizenCraftTracker.exe
