/**
 * Browser playback capabilities sent to Jellyfin's PlaybackInfo. Jellyfin uses
 * this to decide between direct play and an HLS transcode. Runs in the browser.
 */

const H264_MP4 = 'video/mp4; codecs="avc1.640028"';
const HEVC_MP4 = 'video/mp4; codecs="hvc1.1.6.L153.B0"';
const AV1_MP4 = 'video/mp4; codecs="av01.0.08M.08"';
const VP9_WEBM = 'video/webm; codecs="vp9"';
const AC3_MP4 = 'audio/mp4; codecs="ac-3"';
const EAC3_MP4 = 'audio/mp4; codecs="ec-3"';
const FLAC_MP4 = 'audio/mp4; codecs="flac"';
const OPUS_MP4 = 'audio/mp4; codecs="opus"';

const MAX_STREAMING_BITRATE = 120_000_000;

function supports(type: string): boolean {
  if (typeof document === "undefined") return false;
  const video = document.createElement("video");
  return video.canPlayType(type) !== "";
}

export function buildDeviceProfile() {
  const videoCodecs = ["h264"];
  if (supports(HEVC_MP4)) videoCodecs.push("hevc");
  if (supports(AV1_MP4)) videoCodecs.push("av1");
  if (!supports(H264_MP4)) videoCodecs.shift();

  const audioCodecs = ["aac", "mp3"];
  if (supports(AC3_MP4)) audioCodecs.push("ac3");
  if (supports(EAC3_MP4)) audioCodecs.push("eac3");
  if (supports(FLAC_MP4)) audioCodecs.push("flac");
  if (supports(OPUS_MP4)) audioCodecs.push("opus");

  const webmVideo = supports(VP9_WEBM) ? "vp8,vp9,av1" : "vp8";

  return {
    Name: "Movie Crypted Web",
    MaxStreamingBitrate: MAX_STREAMING_BITRATE,
    MaxStaticBitrate: MAX_STREAMING_BITRATE,
    MusicStreamingTranscodingBitrate: 320_000,
    DirectPlayProfiles: [
      { Container: "mp4,m4v", Type: "Video", VideoCodec: videoCodecs.join(","), AudioCodec: audioCodecs.join(",") },
      { Container: "webm", Type: "Video", VideoCodec: webmVideo, AudioCodec: "vorbis,opus" },
      { Container: "mov", Type: "Video", VideoCodec: "h264", AudioCodec: "aac,mp3" },
    ],
    TranscodingProfiles: [
      {
        Container: "ts",
        Type: "Video",
        VideoCodec: "h264",
        AudioCodec: "aac,mp3",
        Protocol: "hls",
        Context: "Streaming",
        MaxAudioChannels: "2",
        MinSegments: 1,
        BreakOnNonKeyFrames: true,
      },
      { Container: "mp4", Type: "Video", VideoCodec: "h264", AudioCodec: "aac", Protocol: "http", Context: "Static" },
    ],
    ContainerProfiles: [],
    CodecProfiles: [
      {
        Type: "Video",
        Codec: "h264",
        Conditions: [
          { Condition: "NotEquals", Property: "IsAnamorphic", Value: "true", IsRequired: false },
          { Condition: "EqualsAny", Property: "VideoProfile", Value: "high|main|baseline|constrained baseline", IsRequired: false },
          { Condition: "LessThanEqual", Property: "VideoLevel", Value: "52", IsRequired: false },
        ],
      },
      {
        Type: "Video",
        Codec: "hevc",
        Conditions: [
          { Condition: "EqualsAny", Property: "VideoProfile", Value: "main|main 10", IsRequired: false },
          { Condition: "LessThanEqual", Property: "VideoLevel", Value: "183", IsRequired: false },
        ],
      },
    ],
    // Browsers only render WebVTT in <track>. Declaring just vtt makes Jellyfin convert
    // SubRip/other text subtitles to vtt on the fly; styled and bitmap subs get burned in.
    SubtitleProfiles: [
      { Format: "vtt", Method: "External" },
      { Format: "ass", Method: "Encode" },
      { Format: "ssa", Method: "Encode" },
      { Format: "pgssub", Method: "Encode" },
      { Format: "dvdsub", Method: "Encode" },
      { Format: "dvbsub", Method: "Encode" },
    ],
  };
}
