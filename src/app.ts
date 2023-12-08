import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { Engine, Scene, Vector3, HemisphericLight, Mesh, MeshBuilder, Quaternion, UniversalCamera, TransformNode } from "@babylonjs/core";
import { POIManager } from "./POIManager";
import test1 from "./test1.json";

class App {
    constructor() {
        var canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.id = "gameCanvas";
        document.body.appendChild(canvas);
        
        var engine = new Engine(canvas, true);
        var scene = new Scene(engine);

        var camera: UniversalCamera = new UniversalCamera("Camera", Vector3.Zero(), scene);
        camera.attachControl(canvas, true);
        camera.fov = 1.047;
        var light1: HemisphericLight = new HemisphericLight("light1", new Vector3(1, 1, 0), scene);
        var cube: Mesh = MeshBuilder.CreateBox("cube", { size: 1 }, scene);
        cube.rotationQuaternion = Quaternion.Identity();
        cube.position = Vector3.Zero();

        var ground = MeshBuilder.CreateGround("ground", {width: 6, height: 6}, scene);

        window.addEventListener("keydown", (ev) => {
            let startManager = () => {
                manager = new POIManager(
                    test1.poiList,
                    test1.flyType,
                    test1.autoRollMaxSpeed,
                    test1.autoRollMaxAngle,
                    test1.frameUpdateTime
                );
                manager.target = transformNode;
                manager.InitialiseFlythrough();
                manager.StartFlythrough();
            }

            if (ev.key === "q") {
                startManager();
            } 

            engine.runRenderLoop(() => {
                camera.position = transformNode.position;
                camera.rotationQuaternion = transformNode.rotationQuaternion;
                scene.render();
                manager.BeforeRenderCalculations(scene.deltaTime);
            }); 
        });

        let manager = new POIManager(
            test1.poiList,
            test1.flyType,
            test1.autoRollMaxSpeed,
            test1.autoRollMaxAngle,
            test1.frameUpdateTime
        );

        let transformNode = new TransformNode("camera");
        transformNode.rotationQuaternion = Quaternion.Identity();   
    }
}
new App();