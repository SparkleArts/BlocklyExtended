# Blockly Extended

A plugin for [MCreator](https://mcreator.net/) that adds new field types to the procedure editor's Blockly workspace, plus blocks built on them. It also replaces a few stock blocks with better versions.

Full documentation: https://wiki.sparklearts.org/index.php?title=BlocklyExtended

| Property | Value |
|---|---|
| Plugin id | `blocklyextended` |
| Author | SparkleArts |
| Version | 1.0 |
| MCreator | 2026.3, 2026.2 |
| Generators | `forge-1.20.1`, `neoforge-1.21.1`, `neoforge-26.1.2`, `neoforge-26.3`, `fabric-26.1.2` |

`neoforge-26.3` has not been tested yet. Its templates are copies of the 26.1.2 ones.

## What it adds

- **Blocks:** an Enums category for declaring and reading local Java enums inside a procedure.
- **Improved stock blocks:** `text` (live `§` colour preview and a lock to hide the value), `direction_constant` (compass picker), `get_localized_text` (live translation preview), `java_code` and `java_code_get` (Java editor dialog).
- **Field types for your own plugins:** text preview, mask toggle, radial direction picker, file picker, toggle group, locale preview, code editor, info popup and more. A normal `field_dropdown` also gains an opt-in `"searchable": true` flag.

See the wiki for how to set up each field with example block JSON.

## Install

1. Download `blocklyextended.zip`. Do not unzip it.
2. Put it in `%USERPROFILE%\.mcreator\plugins`.
3. Make sure Java plugins are enabled in MCreator's preferences.
4. Restart MCreator.

To use it from your own plugin, add `"dependencies": ["blocklyextended"]` under `info` in your `plugin.json`. Your plugin then only loads if Blockly Extended is installed.

## Build

This is not a standalone Gradle project. `settings.gradle` includes the MCreator source tree as a subproject.

1. Clone MCreator next to this folder with `git clone`. Do not use a ZIP download, because it omits the JCEF binaries and the bundled JDK.
2. Check `gradle.properties`. The default `mcreator_path=../MCreator-git` expects the clone in a sibling folder named `MCreator-git`. Change it if yours is elsewhere, and change the JetBrains Runtime paths to match.
3. Java 25 from a JetBrains Runtime with JCEF is required. Keep `auto-download` set to `false`.
4. Run:

```
./gradlew jar
```

This produces `build/libs/blocklyextended.zip`.

To start MCreator with the plugin loaded, which is the only reliable way to check that a field renders and behaves correctly:

```
./gradlew runMCreatorWithPlugin
```

`./gradlew build` fails on unrelated MCreator integration tests outside a full MCreator environment. Use `jar` for normal work.

## Project layout

```
src/main/java/org/sparklearts/blocklyextended/   the Java bridges and the plugin class
src/main/resources/
  plugin.json
  lang/texts.properties                          block and category strings
  procedures/<id>.json                           block definitions
  <generator>/procedures/<id>.java.ftl           code templates, one per generator
  blockly/js/fields/                             custom fields and block extensions
  blockly/js/popups/                             info popup
  blockly/js/util/                               shared helpers
```

JavaScript under `blockly/js/**` loads automatically. When you add a block, add its `.java.ftl` template to every generator folder.

## License

[GPL-3.0](LICENSE), the same license as MCreator. MCreator is a trademark of Pylo.
