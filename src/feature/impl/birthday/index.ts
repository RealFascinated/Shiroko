import ComponentManager from "@/component/index";
import Feature from "@/feature/feature";
import { FeatureIds } from "@/feature/feature-ids";
import SettingsManager from "@/settings/index";
import { birthdaySettings } from "./birthday-settings";
import BirthdayWishComponent from "./birthday-wish.component";
import BirthdayCommand from "./command/birthday/birthday.command";

export default class BirthdayFeature extends Feature {
  constructor() {
    super(FeatureIds.Birthday, { name: "Birthdays", emoji: "🎂" });

    SettingsManager.register(birthdaySettings);
    ComponentManager.register(new BirthdayWishComponent());
    this.registerCommand(new BirthdayCommand());
  }
}
