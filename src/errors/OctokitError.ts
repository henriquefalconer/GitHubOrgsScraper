class OctokitError {
  public readonly octokitErr: any;
  public readonly octokitIndex: number;

  constructor(octokitErr: any, octokitIndex: number) {
    this.octokitErr = octokitErr;
    this.octokitIndex = octokitIndex;
  }
}

export default OctokitError;
