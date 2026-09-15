/** Minimal subset of Jellyfin's BaseItemDto and friends that Movie Crypted uses. */

export type ImageTags = Partial<
  Record<"Primary" | "Backdrop" | "Thumb" | "Logo" | "Banner", string>
>;

export type UserData = {
  PlaybackPositionTicks?: number;
  PlayCount?: number;
  IsFavorite?: boolean;
  Played?: boolean;
  PlayedPercentage?: number;
  UnplayedItemCount?: number;
};

export type MediaStream = {
  Type: "Video" | "Audio" | "Subtitle" | "EmbeddedImage" | "Data" | "Lyric";
  Index: number;
  Codec?: string;
  Language?: string;
  DisplayTitle?: string;
  Title?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
  IsExternal?: boolean;
  IsTextSubtitleStream?: boolean;
  SupportsExternalStream?: boolean;
  DeliveryMethod?: "Encode" | "Embed" | "External" | "Hls" | "Drop";
  DeliveryUrl?: string;
  Width?: number;
  Height?: number;
  VideoRange?: string;
  VideoRangeType?: string;
  Channels?: number;
  ChannelLayout?: string;
  BitRate?: number;
};

export type MediaSource = {
  Id: string;
  Name?: string;
  Container?: string;
  Size?: number;
  Bitrate?: number;
  RunTimeTicks?: number;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  SupportsTranscoding?: boolean;
  TranscodingUrl?: string;
  TranscodingSubProtocol?: string;
  TranscodingContainer?: string;
  MediaStreams?: MediaStream[];
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
};

export type PlaybackInfoResponse = {
  MediaSources: MediaSource[];
  PlaySessionId: string;
  ErrorCode?: string;
};

export type BaseItem = {
  Id: string;
  Name: string;
  Type: string;
  ServerId?: string;
  Overview?: string;
  Taglines?: string[];
  ProductionYear?: number;
  PremiereDate?: string;
  RunTimeTicks?: number;
  OfficialRating?: string;
  CommunityRating?: number;
  CriticRating?: number;
  Genres?: string[];
  GenreItems?: { Id: string; Name: string }[];
  Studios?: { Id: string; Name: string }[];
  People?: {
    Id: string;
    Name: string;
    Role?: string;
    Type?: string;
    PrimaryImageTag?: string;
  }[];
  Tags?: string[];
  ImageTags?: ImageTags;
  BackdropImageTags?: string[];
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  ParentThumbItemId?: string;
  ParentThumbImageTag?: string;
  SeriesId?: string;
  SeriesName?: string;
  SeriesPrimaryImageTag?: string;
  SeasonId?: string;
  SeasonName?: string;
  ParentId?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  ChildCount?: number;
  RecursiveItemCount?: number;
  UserData?: UserData;
  MediaSources?: MediaSource[];
  MediaStreams?: MediaStream[];
  Width?: number;
  Height?: number;
  IsHD?: boolean;
  Container?: string;
  DateCreated?: string;
  Status?: string;
  EndDate?: string;
  ProviderIds?: Record<string, string>;
  ExternalUrls?: { Name: string; Url: string }[];
  CollectionType?: string;
};

export type ItemsResult<T = BaseItem> = {
  Items: T[];
  TotalRecordCount: number;
  StartIndex: number;
};

export type JellyfinUser = {
  Id: string;
  Name: string;
  ServerId?: string;
  PrimaryImageTag?: string;
  Policy?: { IsAdministrator?: boolean; IsDisabled?: boolean };
};

export type AuthResult = {
  User: JellyfinUser;
  AccessToken: string;
  ServerId: string;
  SessionInfo?: { Id: string; DeviceId?: string };
};

export type SessionInfo = {
  Id: string;
  UserId?: string;
  UserName?: string;
  Client?: string;
  DeviceName?: string;
  DeviceId?: string;
  LastActivityDate?: string;
  RemoteEndPoint?: string;
  NowPlayingItem?: BaseItem;
  PlayState?: {
    PositionTicks?: number;
    IsPaused?: boolean;
    PlayMethod?: "Transcode" | "DirectStream" | "DirectPlay";
  };
  TranscodingInfo?: {
    VideoCodec?: string;
    AudioCodec?: string;
    Container?: string;
    IsVideoDirect?: boolean;
    IsAudioDirect?: boolean;
    Bitrate?: number;
    CompletionPercentage?: number;
    Width?: number;
    Height?: number;
    TranscodeReasons?: string[];
  };
};

export type ItemCounts = {
  MovieCount: number;
  SeriesCount: number;
  EpisodeCount: number;
  BoxSetCount: number;
  ItemCount: number;
};

export type FolderStorage = {
  Path: string;
  FreeSpace: number;
  UsedSpace: number;
  StorageType?: string;
  DeviceId?: string;
};

/** Jellyfin 12 groups library folders under the library they belong to. */
export type LibraryStorage = {
  Id: string;
  Name: string;
  Folders: FolderStorage[];
};

export type SystemStorage = {
  ProgramDataFolder?: FolderStorage;
  TranscodingTempFolder?: FolderStorage;
  Libraries: LibraryStorage[];
};

export type ActivityLogEntry = {
  Id: number;
  Name: string;
  ShortOverview?: string;
  Type: string;
  ItemId?: string;
  Date: string;
  UserId?: string;
  Severity?: string;
};

export type SystemInfo = {
  ServerName: string;
  Version: string;
  OperatingSystem?: string;
  OperatingSystemDisplayName?: string;
  SystemArchitecture?: string;
  HasPendingRestart?: boolean;
  HasUpdateAvailable?: boolean;
  Id: string;
};
