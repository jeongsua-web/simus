using System.Collections.Generic;

namespace Simus.City
{
    // Immutable snapshots. JSON numbers are never used to hold a version.
    public sealed class CityStateResponseDto
    {
        public CityStateDto CityState { get; }
        public CityStateResponseDto(CityStateDto cityState) { CityState = cityState; }
    }

    public sealed class CityStateDto
    {
        public string SessionId { get; }
        public string Status { get; }
        public double Happiness { get; }
        public double Safety { get; }
        public double Cleanliness { get; }
        public string Version { get; }
        public string UpdatedAt { get; }
        public double? OverallPollution { get; }
        public IReadOnlyList<RegionStateDto> Regions { get; }
        internal string SnapshotJson { get; }

        internal CityStateDto(string sessionId, string status, double happiness, double safety,
            double cleanliness, string version, string updatedAt, double? overallPollution,
            List<RegionStateDto> regions, string snapshotJson)
        {
            SessionId = sessionId; Status = status; Happiness = happiness; Safety = safety;
            Cleanliness = cleanliness; Version = version; UpdatedAt = updatedAt;
            OverallPollution = overallPollution; Regions = regions.AsReadOnly(); SnapshotJson = snapshotJson;
        }
    }

    public sealed class RegionStateDto
    {
        public string Id { get; }
        public string Code { get; }
        public string Name { get; }
        // Opaque JSON object: no invented coordinate/model schema, no mutable JToken exposed.
        public string MapMetadataJson { get; }
        public double Pollution { get; }
        public string UpdatedAt { get; }

        internal RegionStateDto(string id, string code, string name, string metadata, double pollution, string updatedAt)
        {
            Id = id; Code = code; Name = name; MapMetadataJson = metadata;
            Pollution = pollution; UpdatedAt = updatedAt;
        }
    }
}
