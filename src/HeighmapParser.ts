import { Scalar, Texture, Vector2, Vector3 } from "@babylonjs/core";

export class HeightmapParser {
    private colorHeights: Array<number>;

    public constructor(heightmap: Texture, private heightMapSizeX: number, private heightMapSizeY: number,  private worldMinHeight: number, private worldMaxHeight: number,
        private worldWidth: number, private worldHeight: number, private worldOrigin: Vector2) {
        this.colorHeights = new Array<number>();

        let pixels =  heightmap._readPixelsSync();
        for (let index = 0; index < pixels.byteLength; index += 4) {
            this.colorHeights.push(pixels[index]);
        }
        console.log(this.colorHeights);
    }

    public GetHeight(position: Vector2): number {
        
        const relPos = Vector2.Clamp(position.subtract(this.worldOrigin), Vector2.Zero(), new Vector2(this.worldWidth, this.worldHeight));
      
        const index = (Math.floor(this.heightMapSizeY * relPos.y / this.worldHeight) * this.heightMapSizeX + Math.floor(this.heightMapSizeX * relPos.x / this.worldWidth));
        
        const realHeight = Scalar.Lerp(this.worldMinHeight, this.worldMaxHeight, this.colorHeights[index] / 255);

        return realHeight;
    }
}