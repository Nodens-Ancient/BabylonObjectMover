import "@babylonjs/core";
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Mesh, MeshBuilder, Quaternion, Scalar, BackEase, TransformNode, Matrix } from "@babylonjs/core";
import { POIManager, FlythroughType } from "./POIManager";

export class POI {
    public segmentDistance: number;
    public segmentIndex: number;
    public isLastPOI: boolean = false;
    public isFirstPOI: boolean = false;
    public prevPoi: POI;
    public nextPoi: POI;
    public poiSteps: Vector3[];
    public manager: POIManager;

    private velocityEasingCalculator: Function;
    private rotationEasingCalculator: Function;
    private positionEasingCalculator: Function;

    private rotationStart: Quaternion = Quaternion.Identity();
    private rotationEnd: Quaternion = Quaternion.Identity();

    public transform: TransformNode;

    public constructor(private lookatType: LookatType, private lookAtAngle: number, private lookAtDistance: number,
        private lookatLocation: Vector3, private startSpeed: number, private velocityEasingType: EasingType, private rotationEasingType: EasingType, private m_positionEasingType: EasingType,
        segmentDistance: number, transformPosition: Vector3, transformRotation: Quaternion, private autoRollOn: boolean) {
            this.transform = new TransformNode("POI");
            this.transform.position = transformPosition;
            this.transform.rotationQuaternion = transformRotation;
            this.segmentDistance = segmentDistance;

            this.poiSteps = new Array<Vector3>();
    }

    public Initialise(updateSegments: boolean): void {

        if (this.nextPoi == null && this.prevPoi ==  null) {
            return;
        }

        switch (this.velocityEasingType) {
            case EasingType.Linear: {
                this.velocityEasingCalculator =  this.EaseLinear;
                break;
            }
            case EasingType.EaseIn: {
                this.velocityEasingCalculator = this.EaseIn;
                break;
            }
            case EasingType.EaseOut: {
                this.velocityEasingCalculator = this.EaseOut;
                break;
            }
            case EasingType.EaseInOut: {
                this.velocityEasingCalculator = this.EaseInOut;
            }
        }

        switch (this.m_positionEasingType) {
            case EasingType.Linear: {
                this.positionEasingCalculator = this.EaseLinear;
                break;
            }
            case EasingType.EaseIn: {
                this.positionEasingCalculator = this.EaseIn;
                break;
            }
            case EasingType.EaseOut: {
                this.positionEasingCalculator = this.EaseOut;
                break;
            }
            case EasingType.EaseInOut: {
                this.positionEasingCalculator = this.EaseInOut;
                break;
            }
        }

        switch (this.rotationEasingType) {
            case EasingType.Linear: {
                this.rotationEasingCalculator = this.EaseLinear;
                break;
            }
            case EasingType.EaseIn: {
                this.rotationEasingCalculator = this.EaseIn;
                break;
            }
            case EasingType.EaseOut: {
                this.rotationEasingCalculator = this.EaseOut;
                break;
            }
            case EasingType.EaseInOut: {
                this.rotationEasingCalculator = this.EaseInOut;
                break;
            }
        }

        switch (this.lookatType) {
            case LookatType.Path: {
                this.lookatLocation = this.CalculatePositionSpline(0.005);
                let result = this.GetRelativeOffsets(this.transform.position, this.lookatLocation, this.lookAtDistance, this.lookAtAngle)
                this.lookAtDistance = result.targetDistance;
                this.lookAtAngle = 360 + result.targetAngle;
                break;
            }
            case LookatType.Target: {
                let result = this.GetRelativeOffsets(this.transform.position, this.lookatLocation, this.lookAtDistance, this.lookAtAngle);
                this.lookAtDistance = result.targetDistance;
                this.lookAtAngle = 360 + result.targetAngle;
                break;
            }
        }

        if (this.autoRollOn) {
            if (this.manager.flythroughType == FlythroughType.Looped || (!this.isFirstPOI && !this.isLastPOI)) {
                const posOrigin = this.transform.position;

                let hdgPrevOrigin = posOrigin.subtract(this.prevPoi.transform.position);
                let  qOriginForward = Quaternion.Identity();

                if (hdgPrevOrigin.length() > Number.EPSILON) {
                    qOriginForward = this.LookRotation(hdgPrevOrigin);
                }

                const hdgOriginTarget = this.nextPoi.transform.position.subtract(posOrigin);
                let qOriginTarget = Quaternion.Identity();

                if (hdgOriginTarget.length() > Number.EPSILON) {
                    qOriginTarget = this.LookRotation(hdgOriginTarget);
                }

                let angle = qOriginTarget.toEulerAngles().y - qOriginForward.toEulerAngles().y;
                let scaledSpeed = Scalar.Clamp(this.startSpeed, 0.01, this.manager.autoRollMaxSpeed) / this.manager.autoRollMaxSpeed;
                let scaledAngle = angle;

                if (angle < 0) {
                    scaledAngle = Scalar.Clamp(angle, -90, 0) / 90;
                } else {
                    scaledAngle = Scalar.Clamp(angle, 0, 90) / 90;
                }

                let z = scaledAngle * scaledSpeed * this.manager.autoRollMaxAngle * -1;
                this.transform.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, z);
            }
        }

        let rotationDir = this.lookatLocation.subtract(this.transform.position);
        if (rotationDir.length() > Number.EPSILON) {
            this.LookRotation(this.lookatLocation.subtract(this.transform.position))
            .multiplyToRef(this.transform.rotationQuaternion, this.rotationStart);
        } else {
            this.rotationStart = this.transform.rotationQuaternion;
        }

        rotationDir = this.nextPoi.lookatLocation.subtract(this.nextPoi.transform.position);

        if (rotationDir.length() > Number.EPSILON) {
            this.LookRotation(rotationDir).multiplyToRef(this.nextPoi.transform.rotationQuaternion, this.rotationEnd);
        } else {
            this.rotationEnd = this.nextPoi.transform.rotationQuaternion;
        }

        if (updateSegments) {
            this.UpdateSegments();
        }
    }

    public UpdateSegments() {
        this.segmentDistance = 0;
        
        if (this.manager.flythroughType == FlythroughType.SingleShot && this.manager.GetNextPOI(this, false) == null) {
            return;
        }

        let pct = 0;
        let pos1 = Vector3.Zero();
        let pos2 = Vector3.Zero();

        if (this.nextPoi != null) {
            let stepsPerMeter = 3;
            let measurementsPerMeter = stepsPerMeter * 20; //Another magic multiplier - the more steps per meter the more measurements are required
            let measurement;
            let straightLineDistance = Vector3.Distance(this.transform.position, this.nextPoi.transform.position);
            let totalMeasurments = Math.ceil(measurementsPerMeter * straightLineDistance);
            let measurementIncrement = 1 / totalMeasurments;
            let steppedDistance = 0;

            pos1 = this.transform.position;

            let minMeasurementDistance = 0;
            let maxMeasurementDistance = 0;
            let measurementDistance = 0;
            for (measurement = 1, pct = 0, minMeasurementDistance = 0, maxMeasurementDistance; measurement <= totalMeasurments; measurement++) {
                pct += measurementIncrement;
                pos2 = this.CalculatePositionSpline(pct);
                measurementDistance = Vector3.Distance(pos1, pos2);
                this.segmentDistance += measurementDistance;
                pos1 = pos2;
            }

            if (this.segmentDistance < 2)
            {
                stepsPerMeter *= 3; //Arbitrar magic value
            }

            let expectedStepDistance = 1 / stepsPerMeter;
            expectedStepDistance = this.segmentDistance / Math.floor(this.segmentDistance / expectedStepDistance);

            pos1 = this.transform.position;
            this.poiSteps.push(pos1);

            let minMeasuredStepDistance = 0;
            let maxMeasuredStepDistance = 0;
            let totalSteppedDistance = 0;
            for (measurement = 1, pct = 0, minMeasuredStepDistance = 0, maxMeasuredStepDistance = 0; measurement <= totalMeasurments; measurement++) {
                pct += measurementIncrement;
                pos2 = this.CalculatePositionSpline(pct);

                measurementDistance = Vector3.Distance(pos1, pos2);
                steppedDistance += measurementDistance;
                if (steppedDistance >= expectedStepDistance)
                {
                    while (steppedDistance >= expectedStepDistance)
                    {
                        this.poiSteps.push(Vector3.Lerp(this.poiSteps[this.poiSteps.length-1], pos2, expectedStepDistance / steppedDistance));
                        steppedDistance -= expectedStepDistance;
                        totalSteppedDistance += expectedStepDistance;
                    }
                }
                pos1 = pos2;
            }

            if (((totalSteppedDistance - this.segmentDistance) / expectedStepDistance) < -0.5) {
                this.poiSteps.push(this.nextPoi.transform.position);
            } else {
                this.poiSteps[this.poiSteps.length - 1] = this.nextPoi.transform.position;
            }
        }
    }

    public GetRelativeOffsets(source: Vector3, target: Vector3, targetDistance: number, targetAngle: number) {
        const planarTargetPosition = new Vector3(target.x, source.y, target.z);
        targetDistance = Vector3.Distance(source, planarTargetPosition);

        const targetDirection = source.subtract(target);
        if (targetDirection.length() > Number.EPSILON) {
            console.log(this.LookRotation(targetDirection).toEulerAngles().multiplyByFloats(180 / Math.PI, 180 / Math.PI, 180 / Math.PI));
            targetAngle = this.LookRotation(targetDirection).toEulerAngles().y * 180 / Math.PI;
        } else {
            targetAngle = 0;
        }
        return {
            targetDistance: targetDistance,
            targetAngle: targetAngle
        }
    }

    public CalculateProgress(percent: number, position: Vector3, rotation: Quaternion) {
        const velocity = this.CalculateVelocity(percent);
        rotation.copyFrom(this.CalculateRotation(percent));
        position.copyFrom(this.CalculatePositionLinear(percent));
        return velocity;
    } 

    public CalculatePositionLinear(percent: number): Vector3 {
        percent = this.positionEasingCalculator(percent);

        if (this.poiSteps.length == 0)
        {
            return Vector3.Zero();
        }

        if (this.poiSteps.length == 1) {
            return this.poiSteps[0];
        }

        let maxSegments = this.poiSteps.length - 1;
        let firstSegment = Math.floor(percent * maxSegments);
        if (firstSegment == maxSegments) {
            return this.poiSteps[firstSegment];
        }

        let progress = (percent * maxSegments) - firstSegment;

        return Vector3.Lerp(this.poiSteps[firstSegment], this.poiSteps[firstSegment + 1], progress);
    } 

    public CalculateVelocity(percent: number): number {
       return Scalar.Lerp(this.startSpeed, this.nextPoi.startSpeed, this.velocityEasingCalculator(percent));
    }

    public CalculateRotation(percent: number) : Quaternion {
        return Quaternion.Slerp(this.rotationStart, this.rotationEnd, this.rotationEasingCalculator(percent));
    }

    public CalculatePositionSpline (percent: number): Vector3 {        
        return Vector3.CatmullRom<Vector3>(this.prevPoi.transform.position, 
            this.transform.position, 
            this.nextPoi.transform.position, 
            this.nextPoi.nextPoi.transform.position, 
            percent);
    }

    public CatmullRom(value1: Vector3, value2: Vector3, value3: Vector3, value4: Vector3, amount: number): Vector3 {
        return Vector3.CatmullRom<Vector3>(value1, value2, value3, value4, amount);
    } 

    private EaseLinear(time: number, duration: number = 1): number {
        return time / duration;
    }

    private EaseIn(time: number, duration: number = 1): number {
        return (time /= duration) * time; 
    }

    private EaseOut(time: number, duration: number = 1): number {
        return -1 * (time /= duration) * (time - 2);
    }

    private EaseInOut(time: number, duration: number = 1): number {
        if ((time /= duration/2) < 1)
            return 0.5*time*time;
        return -0.5 * ((--time) * (time - 2) - 1);
    }

    public ApproximatelyEqual(a: number, b: number): boolean {
        if (a == b || Math.abs(a - b) < Number.EPSILON) {
            return true;
        } else {
            return false;
        }
    }

    public LookRotation(pos: Vector3, up: Vector3 = Vector3.Up()): Quaternion {
        let result = Matrix.Zero();
        Matrix.LookAtLHToRef(Vector3.Zero(), pos, up, result);
        result.invert();
        return Quaternion.FromRotationMatrix(result);
    }
}


export enum EasingType {
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut
}

export enum LookatType {
    Path, 
    Target
}

export class POIData {
    pOIDatas: POI[];
}