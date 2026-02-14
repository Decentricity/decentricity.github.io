# Wine Lab Operations (Current System State)

## Slide 1: Current State
- Wine is already installed system-wide on this Ubuntu 24.04 lab machine
- `wine64`, `wine32`, and `winetricks` are present
- Student users: `maple`, `orbit`, `pebble`, `sunny`, `tiger`

## Slide 2: What Is Already Done
- `i386` architecture enabled
- Wine package installed and working
- Wine prefix initialized for each student at `~/.wine`
- Verified per user: `wine --version` and `prefix-ok`

## Slide 3: Verified Baseline
```bash
wine --version
```

## Slide 4: Classroom Demo App (Minesweeper)
- Demo file provided: `Mines-PerfectPortable_1.4.0.4_English.paf.exe`
- App type: portable Minesweeper game (Mines-Perfect)
- Purpose in class: verify Wine runs a real Windows `.exe` in each student account

## Slide 5: Where the File Is
Each student already has a local copy:
- `~/wineapps/minesweeper/Mines-PerfectPortable_1.4.0.4_English.paf.exe`

## Slide 6: Run the Minesweeper EXE
As the student user:
```bash
wine ~/wineapps/minesweeper/Mines-PerfectPortable_1.4.0.4_English.paf.exe
```

## Slide 7: Student Workflow (Daily Use)
- Log in to personal account
- Keep all Windows app data inside personal prefix (`~/.wine`)
- Do not install Windows apps into another user's directory

## Slide 8: Prefix Location and Isolation
- Default prefix: `~/.wine`
- Windows C drive: `~/.wine/drive_c/`
- Prefixes are isolated by Linux user permissions

## Slide 9: Winetricks Usage
Install common dependencies in the current user prefix:
```bash
winetricks -q vcrun2022
winetricks -q corefonts
```
Use only in the current student's account.

## Slide 10: Optional Separate Lab Prefix
If a student needs a clean environment:
```bash
export WINEPREFIX="$HOME/.wine-lab"
export WINEARCH=win64
wineboot --init
```
Then run app with that prefix:
```bash
WINEPREFIX="$HOME/.wine-lab" wine ~/wineapps/minesweeper/Mines-PerfectPortable_1.4.0.4_English.paf.exe
```

## Slide 11: Quick Self-Check
```bash
wine --version
ls ~/wineapps/minesweeper/Mines-PerfectPortable_1.4.0.4_English.paf.exe
```

## Slide 12: Common Problems
- App launches then crashes: install required runtime via `winetricks`
- GUI scaling/audio issues: adjust in `winecfg`
- Prefix corruption: back up and reinitialize prefix

## Slide 13: Reset a Broken Prefix (Per Student)
Run as your own user:
```bash
mv ~/.wine ~/.wine.bak.$(date +%F-%H%M%S)
wineboot --init
```

## Slide 14: Classroom Policy
- One Linux user per student, no shared prefix
- Install only course-required components first
- Keep backup snapshots before major app installs

## Slide 15: Success Criteria (Today)
- You can run `wine --version`
- You can launch `Mines-PerfectPortable_1.4.0.4_English.paf.exe`
- You only work in your own home directory/prefix
