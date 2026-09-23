"""Fail-closed reference manifests; no original assets or optional packages needed."""
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('compare_ui',Path(__file__).resolve().parents[1]/'tools/compare-ui-reference.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class UIReferenceTests(unittest.TestCase):
    def manifest(self):return {'format':'ski-ui-reference','version':1,'frames':[{'screen':'main','reference':'reference.png','actual':'current.png','stateVerified':True,'source':'Personally captured original, English, initial state'}]}
    def test_accepts_a_provenanced_pair(self):self.assertEqual(len(module.validate_manifest(self.manifest())),1)
    def test_empty_is_not_parity(self):
        m=self.manifest();m['frames']=[]
        with self.assertRaises(ValueError):module.validate_manifest(m)
    def test_duplicate_screen(self):
        m=self.manifest();m['frames']*=2
        with self.assertRaises(ValueError):module.validate_manifest(m)
    def test_unknown_screen(self):
        m=self.manifest();m['frames'][0]['screen']='made-up'
        with self.assertRaises(ValueError):module.validate_manifest(m)
    def test_missing_provenance(self):
        m=self.manifest();m['frames'][0]['source']=''
        with self.assertRaises(ValueError):module.validate_manifest(m)
    def test_unmatched_state(self):
        m=self.manifest();m['frames'][0]['stateVerified']=False
        with self.assertRaises(ValueError):module.validate_manifest(m)
    def test_missing_picture(self):
        m=self.manifest();del m['frames'][0]['actual']
        with self.assertRaises(ValueError):module.validate_manifest(m)
if __name__=='__main__':unittest.main()
