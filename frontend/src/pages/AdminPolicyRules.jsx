import { useEffect, useState } from "react";
import { adminGetPolicyRules, adminUpdatePolicyRules } from "../api";
import { FileText, Save, Edit3, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

export default function AdminPolicyRules() {
  const [policyData, setPolicyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isEditingPolicy, setIsEditingPolicy] = useState(false);
  const [editVersion, setEditVersion] = useState("");
  const [editRules, setEditRules] = useState([]);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySaveSuccess, setPolicySaveSuccess] = useState("");

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const policyRes = await adminGetPolicyRules();
        setPolicyData(policyRes.data);
        setEditVersion(policyRes.data?.version || "v2.5");
        setEditRules(policyRes.data?.policy_rules || []);
      } catch (err) {
        setError(err.response?.data?.detail || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicy();
  }, []);

  const handleSavePolicy = async () => {
    if (!editVersion.trim()) {
      setError("Please specify a policy version (e.g. v2.5).");
      return;
    }
    setSavingPolicy(true);
    setPolicySaveSuccess("");
    setError("");
    try {
      await adminUpdatePolicyRules(editVersion, editRules);
      setPolicyData((prev) => ({
        ...prev,
        version: editVersion,
        policy_rules: editRules,
      }));
      setIsEditingPolicy(false);
      setPolicySaveSuccess("Policy rules updated successfully.");
      setTimeout(() => setPolicySaveSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setSavingPolicy(false);
    }
  };

  const addRule = () => {
    setEditRules([
      ...editRules,
      {
        id: `rule_${Date.now()}`,
        description: "New rule description",
        applicable_sub_categories: ["collision"],
        required: true,
      },
    ]);
  };

  const updateRule = (idx, field, value) => {
    const newRules = [...editRules];
    if (field === "applicable_sub_categories") {
      newRules[idx][field] = value.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      newRules[idx][field] = value;
    }
    setEditRules(newRules);
  };

  const removeRule = (idx) => {
    const newRules = [...editRules];
    newRules.splice(idx, 1);
    setEditRules(newRules);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
        <h2 className="text-[22px] font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight">Policy Rules Engine</h2>
          <p className="text-gray-500 mt-1">Manage deterministic screening rules for your company.</p>
        </div>
        {!isEditingPolicy ? (
          <Button onClick={() => setIsEditingPolicy(true)} className="gap-2">
            <Edit3 size={16} /> Edit Rules
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setIsEditingPolicy(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePolicy} disabled={savingPolicy} className="gap-2">
              {savingPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <Separator className="mb-6" />

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {policySaveSuccess && (
        <Alert className="mb-6 border-green-500 text-green-700 bg-green-50">
          <AlertDescription>{policySaveSuccess}</AlertDescription>
        </Alert>
      )}

      {!isEditingPolicy ? (
        <Card className="p-6">
          <div className="mb-6">
            <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Active Version</div>
            <div className="text-xl font-bold mt-1">{policyData?.version || "Unknown"}</div>
          </div>
          <div className="space-y-4">
            {policyData?.policy_rules?.map((rule, idx) => (
              <div key={idx} className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{rule.id}</div>
                    <div className="text-gray-700 dark:text-gray-300 mt-1">{rule.description}</div>
                  </div>
                  {rule.required && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Required</span>
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  Applies to: <span className="font-medium">{(rule.applicable_sub_categories || []).join(", ")}</span>
                </div>
              </div>
            ))}
            {(!policyData?.policy_rules || policyData.policy_rules.length === 0) && (
              <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg">
                No policy rules configured.
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="mb-8 max-w-xs">
            <Label>Policy Version</Label>
            <Input
              value={editVersion}
              onChange={(e) => setEditVersion(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="space-y-6">
            {editRules.map((rule, idx) => (
              <div key={idx} className="p-5 border border-gray-200 rounded-lg relative bg-gray-50 dark:bg-gray-800/50">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => removeRule(idx)}
                >
                  <Trash2 size={16} />
                </Button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Rule ID</Label>
                    <Input
                      value={rule.id}
                      onChange={(e) => updateRule(idx, "id", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Applicable Categories (comma separated)</Label>
                    <Input
                      value={(rule.applicable_sub_categories || []).join(", ")}
                      onChange={(e) => updateRule(idx, "applicable_sub_categories", e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Description (Prompt instructions for AI)</Label>
                    <Textarea
                      value={rule.description}
                      onChange={(e) => updateRule(idx, "description", e.target.value)}
                      className="mt-1.5"
                      rows={2}
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2 mt-2">
                    <Checkbox
                      id={`req_${idx}`}
                      checked={rule.required}
                      onCheckedChange={(checked) => updateRule(idx, "required", checked)}
                    />
                    <Label htmlFor={`req_${idx}`} className="font-normal cursor-pointer leading-none">
                      This rule is strictly required for approval.
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={addRule} className="mt-6 w-full gap-2 border-dashed border-2 text-gray-500">
            <Plus size={16} /> Add New Rule
          </Button>
        </Card>
      )}
    </div>
  );
}
