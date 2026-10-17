export type BedType = "public" | "private";

export interface BedSummary {
  bedId: string;
  bedCode: string;
  bedType: BedType;
  wardId: string;
  wardName: "Emergency Room" | "Female Ward" | "Male Ward" | "Pedia Ward";
  roomId: string | null;
  roomCode: string | null;
  isPrivateRoom: boolean;
  isAvailable: boolean;
}
