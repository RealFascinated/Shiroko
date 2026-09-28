import SettingsManager from "../../../settings";
import Feature from "../../feature";
import { FeatureIds } from "../../feature-ids";
import { birthdaySettings } from "./birthday-settings";
import BirthdayCommand from "./command/birthday/birthday.command";

/**
 * The birthday feature: `/birthday` plus the nightly sweep that swaps the
 * birthday role and announces the day's celebrants. The sweep itself is
 * scheduled by `BirthdayScheduler`, instantiated in `src/index.ts`.
 */
export default class BirthdayFeature extends Feature {
  constructor() {
    super(FeatureIds.Birthday);

    SettingsManager.register(birthdaySettings);
    this.registerCommand(new BirthdayCommand());
  }
}
