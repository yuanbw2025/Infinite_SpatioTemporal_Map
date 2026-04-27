import os
import shapefile
from typing import Optional, Tuple, Dict, Any

GIS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "TotalData", "GISData")
CNTY_SHP = os.path.join(GIS_DIR, "v6_time_cnty_pts_utf_wgs84", "v6_time_cnty_pts_utf_wgs84.shp")
PREF_SHP = os.path.join(GIS_DIR, "v6_time_pref_pts_utf_wgs84", "v6_time_pref_pts_utf_wgs84.shp")

class CHGISCompiler:
    def __init__(self):
        self.pref_dict: Dict[str, Tuple[float, float]] = {}
        self.cnty_dict: Dict[str, Tuple[float, float]] = {}
        self.loaded = False

    def load_data(self):
        if self.loaded:
            return
        
        print("Loading CHGIS Prefecture Points...")
        if os.path.exists(PREF_SHP):
            try:
                sf_pref = shapefile.Reader(PREF_SHP)
                for rec in sf_pref.records():
                    name_ch = rec.NAME_CH
                    if name_ch and name_ch not in self.pref_dict:
                        self.pref_dict[name_ch] = (rec.X_COOR, rec.Y_COOR)
                print(f"Loaded {len(self.pref_dict)} unique prefecture entries.")
            except Exception as e:
                print(f"Error loading prefecture data: {e}")
        else:
            print(f"Warning: {PREF_SHP} not found.")

        print("Loading CHGIS County Points...")
        if os.path.exists(CNTY_SHP):
            try:
                sf_cnty = shapefile.Reader(CNTY_SHP)
                for rec in sf_cnty.records():
                    name_ch = rec.NAME_CH
                    if name_ch and name_ch not in self.cnty_dict:
                        self.cnty_dict[name_ch] = (rec.X_COOR, rec.Y_COOR)
                print(f"Loaded {len(self.cnty_dict)} unique county entries.")
            except Exception as e:
                print(f"Error loading county data: {e}")
        else:
            print(f"Warning: {CNTY_SHP} not found.")
            
        self.loaded = True

    def get_coordinates(self, place_name: str) -> Optional[Tuple[float, float]]:
        """
        Attempts to resolve a place name to (Lng, Lat).
        Prioritizes Prefecture level over County level.
        """
        if not self.loaded:
            self.load_data()
            
        if not place_name:
            return None
            
        # Exact match
        if place_name in self.pref_dict:
            return self.pref_dict[place_name]
        if place_name in self.cnty_dict:
            return self.cnty_dict[place_name]
            
        # Fallback 1: fuzzy match (CHGIS might have "清河县" but AI gave "清河")
        for suffix in ['府', '县', '州', '厅', '路', '郡']:
            if not place_name.endswith(suffix):
                # Try adding the suffix and exact match
                if place_name + suffix in self.pref_dict:
                    return self.pref_dict[place_name + suffix]
                if place_name + suffix in self.cnty_dict:
                    return self.cnty_dict[place_name + suffix]
            else:
                # Try stripping the suffix and exact match
                stripped = place_name[:-len(suffix)]
                if stripped in self.pref_dict:
                    return self.pref_dict[stripped]
                if stripped in self.cnty_dict:
                    return self.cnty_dict[stripped]
                    
        return None

# Singleton instance
compiler = CHGISCompiler()

def get_coordinates(place_name: str) -> Optional[Tuple[float, float]]:
    return compiler.get_coordinates(place_name)

if __name__ == "__main__":
    # Test Mode
    print("=== CHGIS Compiler Test Mode ===")
    test_places = ["清河县", "保德州", "顺天府", "大兴县", "江宁", "不知名小村", "扬州"]
    for place in test_places:
        coords = get_coordinates(place)
        if coords:
            print(f"✅ {place} -> Lng: {coords[0]:.4f}, Lat: {coords[1]:.4f}")
        else:
            print(f"❌ {place} -> Not Found")
