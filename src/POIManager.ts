import "@babylonjs/core";
import { Vector3, Quaternion, Scalar, TransformNode } from "@babylonjs/core";
import { POI } from "./POI";

export class POIManager {
    public target: TransformNode;
    public poiList: Array<POI> = new Array<POI>();

    public flythroughType: FlythroughType = FlythroughType.SingleShot;
    public currentPosition: Vector3 = Vector3.Zero();
    public currentRotation: Quaternion = Quaternion.Identity();
    public currentSegmentIdx: number;
    public currentSegment: POI;

    public canUpdateNow: boolean = false;

    public currentSegmentDistanceTravelled: number = 0;
    public totalDistanceTravelled: number = 0;
    public totalDistanceTravelledPct: number = 0;
    public totalDistance: number = 0;
    public currentVelocity: number = 0;
    public rotationDamping: number = 0.75;
    public positionDamping: number = 0.3;

    public frameUpdateDistance: number = 0;
    public frameUpdateTime: number = 1 / 60;

    public autoRollMaxSpeed: number;
    public autoRollMaxAngle: number;

    public currentState: FlythroughState = FlythroughState.Stopped;

    constructor(poiList: any[], flythroughType: FlythroughType, m_autoRollMaxSpeed: number, autoRollMaxAngle: number,
        frameUpdateTime: number) {
            this.flythroughType = flythroughType;
            this.autoRollMaxSpeed = autoRollMaxAngle;
            this.autoRollMaxSpeed = m_autoRollMaxSpeed;
            this.frameUpdateTime = frameUpdateTime;
            for (let index = 0; index < poiList.length; index++) {
                let poi = new POI(
                    poiList[index].lType,
                    poiList[index].lAngle,
                    poiList[index].lDistance,
                    new Vector3(poiList[index].lLocation.x, poiList[index].lLocation.y, poiList[index].lLocation.z),
                    poiList[index].startSpeed,
                    poiList[index].velocityEType,
                    poiList[index].rotationEType, 
                    poiList[index].positionEType,
                    poiList[index].segmentDist,
                    new Vector3(poiList[index].position.x, poiList[index].position.y, poiList[index].position.z),
                    new Quaternion(poiList[index].rotation.x, poiList[index].rotation.y, poiList[index].rotation.z, poiList[index].rotation.w)
                );
                poi.manager = this;
                this.poiList[index] = poi;
            }
        }

    public InitialiseFlythrough(): void {

        this.currentState = FlythroughState.Initialising;

        let poi: POI = null;   
        for (let index = 0; index < this.poiList.length; index++) {
            poi = this.poiList[index];

            poi.segmentIndex = index;

            if (index == 0) {
                poi.isFirstPOI = true;
            } else {
                poi.isFirstPOI = false;
            }
            if (index == this.poiList.length - 1) {
                poi.isLastPOI = true;
            } else {
                poi.isLastPOI = false;
            }

            if (this.flythroughType == FlythroughType.SingleShot) {
                if (poi.isFirstPOI) {
                    if (this.poiList.length > 1) {
                        poi.prevPoi = this.poiList[1];
                    } else {
                        poi.prevPoi = poi;
                    }
                } 
                else {
                    poi.prevPoi = this.poiList[index - 1];
                }
                
                if (poi.isLastPOI) {
                    if (this.poiList.length > 1) {
                        poi.nextPoi = this.poiList[index - 1];
                    } else {
                        poi.nextPoi = poi;
                    }
                } 
                else {
                    poi.nextPoi = this.poiList[index + 1];
                }
            } 
            else {
                if (index == 0) {
                    poi.prevPoi = this.poiList[this.poiList.length - 1];
                } else {
                    poi.prevPoi = this.poiList[index - 1];
                }

                if (index == this.poiList.length - 1) {
                    poi.nextPoi = this.poiList[0];
                } else {
                    poi.nextPoi = this.poiList[index + 1];
                }
            }
        }

        this.poiList.forEach(p => p.Initialise(false));

        this.totalDistanceTravelledPct = 0;
        this.totalDistanceTravelled = 0;
        this.totalDistance = 0;

        this.poiList.forEach(p => p.Initialise(true));

        this.totalDistance = this.poiList.reduce((acc, current) => acc + current.segmentDistance, 0);

        this.currentSegmentIdx = 0;

        if (this.poiList.length > 0) {
            this.currentSegment = this.poiList[this.currentSegmentIdx];
        } else {
            this.currentSegment = null;
        }

        this.canUpdateNow = true;
    }

    public StartFlythrough(fullInitialize: boolean = false) {
        if (fullInitialize) {
            this.InitialiseFlythrough();
        } else {
            this.RestartFlythrough();
        }

        if (this.target != null) {
            this.currentVelocity = this.currentSegment.CalculateProgress(0, this.currentPosition, this.currentRotation);
            this.target.position.copyFrom(this.currentPosition);
            this.target.rotationQuaternion.copyFrom(this.currentRotation);
        } else {
            this.currentState = FlythroughState.Stopped;
            return;
        }

        this.currentState = FlythroughState.Started;
    }

    public RestartFlythrough() {
        this.currentState = FlythroughState.Initialising;

        this.totalDistanceTravelled = 0;
        this.totalDistanceTravelledPct = 0;

        this.currentSegmentIdx = 0;
        if (this.poiList.length > 0) {
            this.currentSegment = this.poiList[this.currentSegmentIdx];
        } else {
            this.currentSegment = null;
        }

        this.currentSegmentDistanceTravelled = 0;
        this.canUpdateNow = true;
    }

    public BeforeRenderCalculations(deltaTime: number): void {
        deltaTime /= 1000;
        this.frameUpdateTime = deltaTime;

        if (this.currentState != FlythroughState.Started) {
            return;
        }

        this.CalculateFlythroughUpdates();

        if (this.canUpdateNow && this.target != null) {
            if (this.rotationDamping > 0) {
                Quaternion.SlerpToRef(this.target.rotationQuaternion, this.currentRotation, deltaTime * (1 / this.rotationDamping), this.target.rotationQuaternion);             
            }
            else {
                this.target.rotationQuaternion.copyFrom(this.currentRotation);
            }

            if (this.positionDamping > 0) {
                Vector3.SlerpToRef(this.target.position, this.currentPosition, deltaTime * (1 / this.positionDamping), this.target.position);
            } else {
                this.target.position.copyFrom(this.currentPosition);
            }
            this.canUpdateNow = false;    
        }
            
    }

    public CalculateFlythroughUpdates() : void {
        if (this.currentSegment != null) {
            this.currentVelocity = this.currentSegment.CalculateProgress(Scalar.Clamp(this.currentSegmentDistanceTravelled / this.currentSegment.segmentDistance, 0, 1), this.currentPosition, this.currentRotation);
            
            this.frameUpdateDistance = this.frameUpdateTime * this.currentVelocity;
            this.currentSegmentDistanceTravelled += this.frameUpdateDistance;
            this.totalDistanceTravelled += this.frameUpdateDistance;
            this.totalDistanceTravelledPct = this.totalDistanceTravelled / this.totalDistance;
            
            if (this.currentSegmentDistanceTravelled >= this.currentSegment.segmentDistance) {
                this.currentSegmentIdx++;

                if (this.currentSegmentIdx >= this.poiList.length) {
                    if (this.flythroughType == FlythroughType.Looped) {
                        this.currentSegmentIdx = 0;
                        this.currentSegmentDistanceTravelled -= this.currentSegment.segmentDistance;
                        this.totalDistanceTravelled = this.totalDistance;
                    }
                    else {
                        this.currentSegmentIdx--;
                        this.currentSegmentDistanceTravelled = this.currentSegment.segmentDistance;
                        this.totalDistanceTravelled = this.totalDistance;
                        this.totalDistanceTravelledPct = 1;

                        this.StopFlythrough();
                        return;
                    }
                }
                else {
                    this.currentSegmentDistanceTravelled -= this.currentSegment.segmentDistance;
                }

                this.totalDistanceTravelledPct = this.totalDistanceTravelled / this.totalDistance;
                this.currentSegment = this.poiList[this.currentSegmentIdx];

                if (this.currentState != FlythroughState.Started) {
                    this.canUpdateNow = false;
                    return;
                }
            }
        }

        this.canUpdateNow = true;
    }

    public StopFlythrough(): void {
        this.currentState = FlythroughState.Stopped;
        this.canUpdateNow = false;
    }

    public GetNextPOI(currentPoi: POI, wrap: boolean): POI {
        if (currentPoi == null) {
            return null;
        }

        if (currentPoi.segmentIndex < this.poiList.length - 1) {
            return this.poiList[currentPoi.segmentIndex + 1];
        } 
        if (wrap) {
            return this.poiList[0];
        }        
        return null;   
    }   
}


export enum FlythroughType {
    SingleShot,
    Looped
}

export enum FlythroughState {
    Stopped,
    Initialising,
    Started,
    Paused
}