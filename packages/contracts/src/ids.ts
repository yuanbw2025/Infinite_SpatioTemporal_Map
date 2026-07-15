export type Id<Kind extends string> = string & { readonly __kind: Kind };

export type WorkId = Id<"WorkId">;
export type EditionId = Id<"EditionId">;
export type VolumeId = Id<"VolumeId">;
export type PassageId = Id<"PassageId">;
export type FacsimilePageId = Id<"FacsimilePageId">;
export type EntityId = Id<"EntityId">;
export type MentionId = Id<"MentionId">;
export type AssertionId = Id<"AssertionId">;
export type PlaceIdentityId = Id<"PlaceIdentityId">;
export type GeometryId = Id<"GeometryId">;
export type CollectionId = Id<"CollectionId">;
