# PlantUML

[PlantUML](http://plantuml.com) is used for the technical diagrams using [Unified Modeling Language (UML)](https://en.wikipedia.org/wiki/Unified_Modeling_Language) and [Archimate](https://www.itmg-int.com/itmg-int-wp-content/Archimate/An%20Introduction%20to%20Archimate%203.0.pdf).

The PlantUML files have the `.puml` file extension.

## VS Code extension

[Jebbs PlantUML](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) extension for VS Code is used to authoring the PlantUML diagrams.

The following settings are used in VS Code settings.json file:

```json
    "plantuml.exportOutDir": "contracts/docs/plantuml",
    "plantuml.exportFormat": "png",
    "plantuml.exportIncludeFolderHeirarchy": false,
    "plantuml.exportSubFolder": false,
```

`Alt-D` on Windows, or `Option-D` on Mac, to start PlantUML preview in VS Code.

To save the PlantUML diagram as a PNG file, right-click on the diagram and select `Export Current Diagram`. This will save to where the `plantuml.exportOutDir` setting is set to.
