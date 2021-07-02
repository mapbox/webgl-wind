#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

function usage() {
  cat <<EOF
  usage: download.sh <directory> [<date>   <hour>]
    e.g. download.sh demo/wind    20210701 00
EOF
}

if ! [ -d "${1}" ]; then
  echo "error: directory does not exist" >&2
  usage >&2
  exit 2
fi
cd "${1}"

# Default date & time is 2021-07-01 at 00 hours
GFS_DATE="${2:=20210701}"
GFS_TIME="${3:=00}"; # 00, 06, 12, 18

if ! echo "${GFS_DATE}${GFS_TIME}" | egrep -q '^[0-9]{10}$'; then
  echo "error: incorrect date / time format" >&2
  usage >&2
  exit 2
fi

RES="1p00" # 0p25, 0p50 or 1p00
BBOX="leftlon=0&rightlon=360&toplat=90&bottomlat=-90"
LEVEL="lev_10_m_above_ground=on"
GFS_URL="https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_${RES}.pl?file=gfs.t${GFS_TIME}z.pgrb2.${RES}.anl&lev_max_wind=on&${BBOX}&dir=%2Fgfs.${GFS_DATE}%2F${GFS_TIME}%2Fatmos"


curl -L "${GFS_URL}&var_UGRD=on" -o utmp.grib
curl -L "${GFS_URL}&var_VGRD=on" -o vtmp.grib

grib_set -r -s packingType=grid_simple utmp.grib utmp.grib.new
grib_set -r -s packingType=grid_simple vtmp.grib vtmp.grib.new
mv utmp.grib.new utmp.grib
mv vtmp.grib.new vtmp.grib

printf "{\"u\":`grib_dump -j utmp.grib`,\"v\":`grib_dump -j vtmp.grib`}" > tmp.json

rm utmp.grib vtmp.grib

node ${DIR}/prepare.js ./${GFS_DATE}${GFS_TIME}

rm tmp.json
