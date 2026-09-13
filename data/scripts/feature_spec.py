"""Feature vector specification for AcousticBrainz low-level docs.

Rules (from the experiment brief):
- stat-pack scalars -> mean, var, dmean2 only
- list features -> the `mean` array only (mfcc/gfcc have only mean; cov/icov excluded)
- fixed-length plain lists (chords_histogram, thpcp) included as-is
- metadata.* excluded; variable-length series (beats_position) excluded
- bpm_histogram_{first,second}_peak_* -> mean only
- string features (key_key etc.) stored separately, not in the numeric vector
Blocks: timbre / rhythm / tonal / dynamics
"""

# (section, key) -> stat-pack scalar (use mean/var/dmean2)
STAT_SCALARS = [
    ("lowlevel", "barkbands_crest"), ("lowlevel", "barkbands_flatness_db"),
    ("lowlevel", "barkbands_kurtosis"), ("lowlevel", "barkbands_skewness"),
    ("lowlevel", "barkbands_spread"), ("lowlevel", "dissonance"),
    ("lowlevel", "erbbands_crest"), ("lowlevel", "erbbands_flatness_db"),
    ("lowlevel", "erbbands_kurtosis"), ("lowlevel", "erbbands_skewness"),
    ("lowlevel", "erbbands_spread"), ("lowlevel", "hfc"),
    ("lowlevel", "melbands_crest"), ("lowlevel", "melbands_flatness_db"),
    ("lowlevel", "melbands_kurtosis"), ("lowlevel", "melbands_skewness"),
    ("lowlevel", "melbands_spread"), ("lowlevel", "pitch_salience"),
    ("lowlevel", "silence_rate_20dB"), ("lowlevel", "silence_rate_30dB"),
    ("lowlevel", "silence_rate_60dB"), ("lowlevel", "spectral_centroid"),
    ("lowlevel", "spectral_complexity"), ("lowlevel", "spectral_decrease"),
    ("lowlevel", "spectral_energy"), ("lowlevel", "spectral_energyband_high"),
    ("lowlevel", "spectral_energyband_low"), ("lowlevel", "spectral_energyband_middle_high"),
    ("lowlevel", "spectral_energyband_middle_low"), ("lowlevel", "spectral_entropy"),
    ("lowlevel", "spectral_flux"), ("lowlevel", "spectral_kurtosis"),
    ("lowlevel", "spectral_rms"), ("lowlevel", "spectral_rolloff"),
    ("lowlevel", "spectral_skewness"), ("lowlevel", "spectral_spread"),
    ("lowlevel", "spectral_strongpeak"), ("lowlevel", "zerocrossingrate"),
    ("rhythm", "beats_loudness"),
    ("tonal", "chords_strength"), ("tonal", "hpcp_entropy"),
]
STAT_BRANCHES = ["mean", "var", "dmean2"]

# bpm_histogram peaks: mean only
BPM_PEAK_SCALARS = [
    ("rhythm", "bpm_histogram_first_peak_bpm"),
    ("rhythm", "bpm_histogram_first_peak_spread"),
    ("rhythm", "bpm_histogram_first_peak_weight"),
    ("rhythm", "bpm_histogram_second_peak_bpm"),
    ("rhythm", "bpm_histogram_second_peak_spread"),
    ("rhythm", "bpm_histogram_second_peak_weight"),
]

# (section, key, expected_len) -> stat-pack lists, `mean` array only
LIST_MEANS = [
    ("lowlevel", "barkbands", 27),
    ("lowlevel", "erbbands", 40),
    ("lowlevel", "melbands", 40),
    ("lowlevel", "mfcc", 13),
    ("lowlevel", "gfcc", 13),
    ("lowlevel", "spectral_contrast_coeffs", 6),
    ("lowlevel", "spectral_contrast_valleys", 6),
    ("rhythm", "beats_loudness_band_ratio", 6),
    ("tonal", "hpcp", 36),
]

# (section, key, expected_len) -> plain fixed-length lists included as-is
PLAIN_LISTS = [
    ("tonal", "chords_histogram", 24),
    ("tonal", "thpcp", 36),
]

# (section, key) -> plain float scalars
PLAIN_SCALARS = [
    ("lowlevel", "average_loudness"), ("lowlevel", "dynamic_complexity"),
    ("rhythm", "bpm"), ("rhythm", "danceability"), ("rhythm", "onset_rate"),
    ("rhythm", "beats_count"),
    ("tonal", "chords_changes_rate"), ("tonal", "chords_number_rate"),
    ("tonal", "key_strength"), ("tonal", "tuning_diatonic_strength"),
    ("tonal", "tuning_equal_tempered_deviation"), ("tonal", "tuning_frequency"),
    ("tonal", "tuning_nontempered_energy_ratio"),
]

STRING_FEATURES = [
    ("tonal", "key_key"), ("tonal", "key_scale"),
    ("tonal", "chords_key"), ("tonal", "chords_scale"),
]


def _block(section, key):
    name = key.lower()
    if "loudness" in name or "silence" in name or "dynamic" in name:
        return "dynamics"
    if section == "tonal":
        return "tonal"
    if section == "rhythm" or name == "zerocrossingrate":
        return "rhythm"
    return "timbre"


def build_columns():
    """Return list of (col_name, section, key, branch_or_index, block)."""
    cols = []
    for sec, key in STAT_SCALARS:
        for br in STAT_BRANCHES:
            cols.append((f"{sec}.{key}.{br}", sec, key, br, _block(sec, key)))
    for sec, key in BPM_PEAK_SCALARS:
        cols.append((f"{sec}.{key}.mean", sec, key, "mean", _block(sec, key)))
    for sec, key, n in LIST_MEANS:
        for i in range(n):
            cols.append((f"{sec}.{key}.mean.{i}", sec, key, ("mean", i), _block(sec, key)))
    for sec, key, n in PLAIN_LISTS:
        for i in range(n):
            cols.append((f"{sec}.{key}.{i}", sec, key, (None, i), _block(sec, key)))
    for sec, key in PLAIN_SCALARS:
        cols.append((f"{sec}.{key}", sec, key, None, _block(sec, key)))
    return cols


COLUMNS = build_columns()
FEATURE_NAMES = [c[0] for c in COLUMNS]
FEATURE_BLOCKS = {c[0]: c[4] for c in COLUMNS}

NAN = float("nan")


def extract_features(doc):
    """Flatten one parsed low-level doc into a list of float values (order = COLUMNS)."""
    out = []
    for _, sec, key, branch, _ in COLUMNS:
        try:
            v = doc[sec][key]
            if branch is None:                       # plain scalar
                out.append(float(v))
            elif isinstance(branch, str):            # stat branch
                out.append(float(v[branch]))
            else:
                br, idx = branch
                arr = v[br] if br is not None else v  # list mean / plain list
                out.append(float(arr[idx]))
        except (KeyError, TypeError, IndexError, ValueError):
            out.append(NAN)
    return out


def extract_strings(doc):
    out = []
    for sec, key in STRING_FEATURES:
        try:
            out.append(str(doc[sec][key]))
        except (KeyError, TypeError):
            out.append("")
    return out


if __name__ == "__main__":
    from collections import Counter
    print("total numeric features:", len(COLUMNS))
    print(Counter(c[4] for c in COLUMNS))
